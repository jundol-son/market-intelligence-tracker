'use client';
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export type EmailRecipient = { id: number | null; email: string; source: 'DATABASE' | 'ENV' };

export function EmailRecipients({ recipients, onChange }: { recipients: EmailRecipient[]; onChange: (value: EmailRecipient[]) => void }) {
  const [email, setEmail] = useState('');
  const value = email.trim().toLowerCase();
  const canAdd = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && !recipients.some((item) => item.email === value);
  const add = () => {
    if (!canAdd) return;
    onChange([...recipients, { id: null, email: value, source: 'DATABASE' }]);
    setEmail('');
  };
  return <section className={'mt-5 rounded-xl border bg-slate-50/60 p-4'}>
    <h3 className={'font-semibold'}>메일 수신인</h3>
    <p className={'mt-1 text-xs text-muted-foreground'}>추가한 주소는 설정 저장 후 다음 발송부터 함께 수신합니다.</p>
    <div className={'mt-3 flex flex-col gap-2 sm:flex-row'}>
      <Input aria-label={'추가할 메일 수신인'} type={'email'} value={email} onChange={(event) => setEmail(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); add(); } }} placeholder={'name@example.com'} />
      <Button type={'button'} variant={'outline'} onClick={add} disabled={!canAdd}><Plus />수신인 추가</Button>
    </div>
    <div className={'mt-3 flex flex-wrap gap-2'}>{recipients.map((item) => <span key={item.source + item.email} className={'inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-xs'}>{item.email}{item.source === 'ENV' ? <b className={'text-blue-600'}>기존 설정</b> : <button type={'button'} aria-label={item.email + ' 삭제'} className={'text-rose-600'} onClick={() => onChange(recipients.filter((candidate) => candidate !== item))}><Trash2 className={'size-3.5'} /></button>}</span>)}</div>
  </section>;
}
