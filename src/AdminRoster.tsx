import {eventLabelFor} from './adminRosterEvents';

export type AdminRosterEvent={id:number;type:string;province?:string|null;duty_date?:string|null;created_at?:string|null};

export default function AdminRoster({events}:{events:AdminRosterEvent[]}){
  return <div className="panel">
    <h2>Elle Nöbet Listesi Geçmişi</h2>
    {events.length?events.map(event=><div className="admin-item" key={event.id}>
      <div><b>{eventLabelFor(event.type)}</b><small>{[event.province,event.duty_date].filter(Boolean).join(' · ')}</small></div>
      {event.created_at&&<time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString('tr-TR')}</time>}
    </div>):<p>Henüz nöbet listesi olayı yok.</p>}
  </div>;
}