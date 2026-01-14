
import React, { useState } from 'react';
import LandingPage from './components/landing/LandingPage';
import RoomBookingSystem from './components/room/RoomBookingSystem';
import EquipmentSystem from './components/equipment/EquipmentSystem';
import { SystemType } from './types';
import Navbar from './components/layout/Navbar';

const App: React.FC = () => {
  const [currentSystem, setCurrentSystem] = useState<SystemType>('landing');

  const renderSystem = () => {
    switch (currentSystem) {
      case 'room':
        return <RoomBookingSystem />;
      case 'equipment':
        return <EquipmentSystem />;
      case 'landing':
      default:
        return <LandingPage onSelectSystem={setCurrentSystem} />;
    }
  };

  const goBackToLanding = () => {
    setCurrentSystem('landing');
  };

  return (
    <div className="app-container flex flex-col min-h-screen bg-gradient-to-br from-[#5071A4] to-[#9AACC8]">
      <Navbar currentSystem={currentSystem} onBackToLanding={goBackToLanding} />
      <main className="main-content flex-1 p-4 md:p-8 w-full">
        {renderSystem()}
      </main>
    </div>
  );
};

export default App;
