
import React, { useMemo } from 'react';
import { Booking } from '../../types';
import { ROOMS } from '../../constants';
import Button from '../shared/Button';

interface StatisticsPageProps {
  bookings: Booking[];
  onBack: () => void;
}

const StatCard: React.FC<{icon: string, title: string, value: string | number, description: string, color: string}> = ({icon, title, value, description, color}) => (
    <div className={`p-6 rounded-2xl border bg-white shadow-sm`}>
        <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl bg-opacity-10 ${color.replace('text', 'bg').replace('-600', '-100')}`}>
                <span className={`text-2xl ${color}`}>{icon}</span>
            </div>
            <div>
                <p className="text-sm font-semibold text-gray-500">{title}</p>
                <p className={`text-3xl font-bold ${color}`}>{value}</p>
            </div>
        </div>
        <p className="text-xs text-gray-400 mt-3">{description}</p>
    </div>
);

const StatisticsPage: React.FC<StatisticsPageProps> = ({ bookings, onBack }) => {
  const stats = useMemo(() => {
    const activeBookings = bookings.filter(b => b.status === 'จองแล้ว' || b.status === 'หมดเวลา');
    
    const bookingsByRoom = ROOMS.map(room => {
      const roomBookings = activeBookings.filter(b => b.roomName === room.name);
      return {
        name: room.name,
        count: roomBookings.length,
      };
    }).sort((a,b) => b.count - a.count);

    const totalBookings = activeBookings.length;
    
    return {
      totalBookings,
      bookingsByRoom,
    };
  }, [bookings]);

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8">
        <div className="flex items-center gap-4 mb-6 pb-5 border-b border-gray-200">
          <button 
            onClick={onBack}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-200 transition-all active:scale-95 flex items-center gap-2"
          >
            <span>←</span> กลับ
          </button>
          <h2 className="text-xl md:text-2xl font-bold text-gray-800">สถิติการใช้งานห้องประชุม</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <StatCard 
                icon="📈"
                title="การจองทั้งหมด"
                value={stats.totalBookings}
                description="นับเฉพาะรายการที่สำเร็จและจองแล้ว"
                color="text-blue-600"
            />
             <StatCard 
                icon="🏆"
                title="ห้องยอดนิยม"
                value={stats.bookingsByRoom[0]?.name || '-'}
                description="ห้องที่มีการจองมากที่สุด"
                color="text-green-600"
            />
             <StatCard 
                icon="✅"
                title="จำนวนครั้งที่ใช้"
                value={stats.bookingsByRoom[0]?.count || 0}
                description={`ของห้อง ${stats.bookingsByRoom[0]?.name || 'ยอดนิยม'}`}
                color="text-orange-600"
            />
        </div>
        
        <div>
            <h3 className="text-lg font-semibold text-gray-700 mb-4">อันดับการใช้งานห้องทั้งหมด</h3>
             <div className="space-y-3">
                {stats.bookingsByRoom.map((room, index) => (
                    <div key={room.name} className="flex items-center bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <div className={`text-lg font-bold w-10 text-center ${index < 3 ? 'text-blue-600' : 'text-gray-400'}`}>
                            #{index + 1}
                        </div>
                        <div className="flex-1">
                            <p className="font-semibold text-gray-800">{room.name}</p>
                        </div>
                        <div className="font-bold text-blue-600 bg-blue-100 text-sm px-4 py-2 rounded-lg">
                            {room.count} ครั้ง
                        </div>
                    </div>
                ))}
            </div>
        </div>

      </div>
    </div>
  );
};

export default StatisticsPage;