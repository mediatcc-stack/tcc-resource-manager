import React from 'react';
import { RoomPage } from '../../types';

interface NavButtonProps {
    page: RoomPage;
    label: string;
    icon: string;
    currentPage: RoomPage;
    setCurrentPage: (page: RoomPage) => void;
}

const NavButton: React.FC<NavButtonProps> = ({ page, label, icon, currentPage, setCurrentPage }) => {
    const isActive = currentPage === page;
    const baseClasses = 'flex items-center gap-2 text-sm font-bold rounded-xl transition-all duration-300';
    const activeClasses = 'bg-[#0D448D] text-white px-5 py-2.5 shadow-md';
    const inactiveClasses = 'bg-transparent text-slate-500 hover:text-[#0D448D] px-3 py-2.5 hover:bg-blue-50';

    return (
        <button 
        onClick={() => setCurrentPage(page)}
        className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses}`}
        >
        <span>{icon}</span> {label}
        </button>
    );
};

export default NavButton;