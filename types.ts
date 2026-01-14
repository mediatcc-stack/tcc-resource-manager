
export type SystemType = 'landing' | 'room' | 'equipment';
export type RoomPage = 'home' | 'booking' | 'mybookings' | 'statistics';
export type EquipmentPage = 'list' | 'form';

export interface Room {
  id: number;
  name: string;
  status: 'available' | 'closed';
}

export interface Booking {
  id: string;
  groupId?: string;
  roomName: string;
  date: string;
  startTime: string;
  endTime: string;
  bookerName: string;
  phone: string;
  participants: number;
  meetingType: 'Online' | 'Onsite';
  purpose: string;
  equipment: string;
  status: 'จองแล้ว' | 'ยกเลิก' | 'หมดเวลา';
  createdAt: string;
  attachmentUrl?: string;
  isMultiDay: boolean;
  dateRange?: string;
}

export enum BorrowStatus {
  Pending = 'รออนุมัติ',
  Borrowing = 'อยู่ระหว่างการยืม',
  Returned = 'คืนแล้ว',
  Overdue = 'เกินกำหนด',
}

export interface BorrowingRequest {
  id: string;
  borrowerName: string;
  phone: string;
  department: string;
  purpose: string;
  borrowDate: string;
  returnDate: string;
  equipmentList: string;
  status: BorrowStatus;
  createdAt: string;
  notes: string;
}

export interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'error';
}
