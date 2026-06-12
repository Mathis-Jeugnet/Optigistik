"use client";


export interface MessageData {
  id: string;
  name: string;
  time: string;
  content: string;
  unread: boolean;
}

interface MessagesListProps {
  messages: MessageData[];
  unreadCount?: number;
  onItemClick?: (id: string) => void;
}

export default function MessagesList({ messages, unreadCount = 0, onItemClick }: MessagesListProps) {
  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col h-full">
      <div className="flex justify-between items-center mb-5">
        <h3 className="text-lg font-bold text-opti-blue font-display">Messages récents</h3>
        {unreadCount > 0 && (
          <span className="bg-red-50 text-opti-red text-[10px] font-bold px-2 py-1 rounded-md tracking-wider">
            {unreadCount} NON-LUS
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2 flex-1">
        {messages.length > 0 ? (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 rounded-xl px-2 py-1.5 -mx-2 transition-colors ${onItemClick ? "cursor-pointer hover:bg-gray-50" : ""}`}
              onClick={() => onItemClick?.(msg.id)}
            >
              <div className="relative shrink-0 mt-0.5">
                <div className="w-9 h-9 rounded-full bg-opti-blue flex items-center justify-center text-white font-bold text-sm">
                  {msg.name.charAt(0).toUpperCase()}
                </div>
                {msg.unread && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-opti-red border-2 border-white rounded-full"></div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-1">
                  <h4 className="text-sm font-bold text-opti-blue truncate">{msg.name}</h4>
                  <span className="text-[10px] text-slate-400 shrink-0 ml-2 font-medium">{msg.time}</span>
                </div>
                <p className="text-xs text-slate-500 truncate leading-relaxed">{msg.content}</p>
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-full min-h-[100px] text-gray-400">
            <p>Aucun message</p>
          </div>
        )}
      </div>
    </div>
  );
}
