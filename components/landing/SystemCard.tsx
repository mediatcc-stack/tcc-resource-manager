
import React from 'react';

interface SystemCardProps {
  icon: string;
  title: string;
  description: string;
  onClick: () => void;
}

const SystemCard: React.FC<SystemCardProps> = ({ icon, title, description, onClick }) => {
  return (
    <div
      onClick={onClick}
      className="bg-white p-8 md:p-10 rounded-2xl shadow-xl hover:shadow-2xl cursor-pointer transition-all duration-300 transform hover:-translate-y-2 border-4 border-transparent hover:border-[#0D448D]"
    >
      <div className="text-7xl md:text-8xl mb-4">{icon}</div>
      <h2 className="text-2xl font-bold text-[#0D448D] mb-3">{title}</h2>
      <p className="text-gray-600 leading-relaxed">{description}</p>
    </div>
  );
};

export default SystemCard;
