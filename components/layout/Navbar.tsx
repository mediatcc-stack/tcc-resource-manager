
import React from 'react';
import { SystemType } from '../../types';
import { APP_CONFIG } from '../../constants';

interface NavbarProps {
  currentSystem: SystemType;
  onBackToLanding: () => void;
  // In a real app, page navigation would be handled by props from parent components
}

const Navbar: React.FC<NavbarProps> = ({ currentSystem, onBackToLanding }) => {
  
  const renderNavButtons = () => {
    if (currentSystem === 'landing') {
      return null;
    }
    
    // In a full implementation, these would trigger state changes in their parent system components
    const roomButtons = (
      <>
        <button className="nav-btn active">🏠 หน้าแรก</button>
        <button className="nav-btn">📋 รายการจอง</button>
        <button className="nav-btn">📊 สถิติ</button>
      </>
    );

    const equipmentButtons = (
      <>
        <button className="nav-btn active">📋 รายการยืม</button>
      </>
    );

    return (
       <div className="flex items-center gap-2 flex-wrap justify-center">
         <button onClick={onBackToLanding} className="nav-btn mr-4">← กลับหน้าหลัก</button>
         {currentSystem === 'room' ? roomButtons : equipmentButtons}
       </div>
    );
  };
  
  return (
    <nav className="bg-white p-4 md:p-5 shadow-lg flex justify-between items-center flex-wrap gap-4">
      <div className="text-xl md:text-2xl font-bold text-[#0D448D]">
        {APP_CONFIG.collegeName}
      </div>
       <style>{`
        .nav-btn {
            padding: 8px 16px;
            border: none;
            background: #f0f0f0;
            color: #333;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
            transition: all 0.3s;
        }
        .nav-btn:hover {
            background: #e0e0e0;
            transform: translateY(-2px);
        }
        .nav-btn.active {
            background: #0D448D;
            color: #FCFCFD;
        }
       `}</style>
      {/* The following is a simplified navigation placeholder. In a full app, this would be managed by state within each system component. */}
      {currentSystem !== 'landing' && (
        <div className="hidden md:flex items-center gap-2">
            <button onClick={onBackToLanding} className="nav-btn">← กลับหน้าหลัก</button>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
