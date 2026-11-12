import React, { useRef, useState, type FormEvent } from 'react';
import { Link } from 'expo-router';
import AppHeader from '@/components/AppHeader';
import WebShell from '@/components/web/WebShell';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export default function WebFeedback() {
  const { user, isLoading } = useAuth();
  const [text, setText] = useState('');
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');
  const sending = useRef(false);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = text.trim();
    if (!user || sending.current) return;
    if (!message) {
      setNotice('Санал хүсэлтээ бичнэ үү.');
      return;
    }
    sending.current = true;
    setPending(true);
    setNotice('');
    try {
      const { error } = await supabase.from('feedback').insert({
        user_id: user.id,
        message,
        platform: 'web',
      });
      if (error) throw error;
      setText('');
      setNotice('Баярлалаа. Таны санал хүсэлтийг хүлээж авлаа.');
    } catch {
      setNotice('Санал хүсэлт илгээгдсэнгүй. Дахин оролдоорой.');
    } finally {
      sending.current = false;
      setPending(false);
    }
  }

  return <WebShell>
    <div className="tw-help-content">
      <AppHeader title="Санал хүсэлт" />
      <form className="tw-feedback-form" onSubmit={send}>
        <label htmlFor="feedback-message">Arivly-г сайжруулах санал эсвэл илэрсэн алдаагаа бичээрэй.</label>
        <textarea id="feedback-message" placeholder="Энд бичнэ үү…" value={text}
          onChange={event => setText(event.target.value)} disabled={pending} />
        {isLoading ? <p role="status">Түр хүлээнэ үү…</p> : user
          ? <button className="tw-button" type="submit" disabled={pending}>{pending ? 'Илгээж байна…' : 'Илгээх'}</button>
          : <Link className="tw-button" href="/auth">Илгээхийн тулд нэвтрэх</Link>}
        <p role="status">{notice}</p>
      </form>
    </div>
  </WebShell>;
}
