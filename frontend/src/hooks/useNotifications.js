import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useNotifications() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!user) return
    fetchNotifications()

    // Realtime: écouter nouvelles notifs
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        setNotifications(prev => [payload.new, ...prev])
        setUnreadCount(prev => prev + 1)
        // Notification navigateur
        showBrowserNotification(payload.new)
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [user])

  async function fetchNotifications() {
    const { data } = await supabase
      .from('notifications')
      .select('*, documents(title)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (data) {
      setNotifications(data)
      setUnreadCount(data.filter(n => !n.is_read).length)
    }
  }

  async function markAsRead(notifId) {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notifId)

    setNotifications(prev =>
      prev.map(n => n.id === notifId ? { ...n, is_read: true } : n)
    )
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  async function markAllAsRead() {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false)

    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnreadCount(0)
  }

  function showBrowserNotification(notif) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notif.title, {
        body: notif.message,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: notif.id
      })
    }
  }

  async function requestPushPermission() {
    if (!('Notification' in window)) return false
    const permission = await Notification.requestPermission()
    return permission === 'granted'
  }

  async function subscribePush() {
    console.log('subscribePush called')
    console.log('serviceWorker:', 'serviceWorker' in navigator)
    console.log('PushManager:', 'PushManager' in window)
    console.log('VAPID KEY:', import.meta.env.VITE_VAPID_PUBLIC_KEY ? 'OK' : 'MISSING')
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false
    if (!import.meta.env.VITE_VAPID_PUBLIC_KEY) return false

    try {
      // Enregistrer notre Service Worker
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      await navigator.serviceWorker.ready

      // Vérifier si déjà abonné
      const existing = await reg.pushManager.getSubscription()
      if (existing) {
        const subJson = existing.toJSON()
        await supabase.from('push_subscriptions').upsert({
          user_id: user.id,
          endpoint: subJson.endpoint,
          p256dh: subJson.keys.p256dh,
          auth: subJson.keys.auth
        }, { onConflict: 'endpoint' })
        return true
      }

      // Nouvelle souscription
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY)
      })

      const subJson = sub.toJSON()
      await supabase.from('push_subscriptions').upsert({
        user_id: user.id,
        endpoint: subJson.endpoint,
        p256dh: subJson.keys.p256dh,
        auth: subJson.keys.auth
      }, { onConflict: 'endpoint' })
      return true
    } catch (err) {
      console.error('Erreur push subscription:', err)
      return false
    }
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
    return outputArray
  }

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    requestPushPermission,
    subscribePush,
    refetch: fetchNotifications
  }
}
