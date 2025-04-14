export interface User {
    id: string;
    name: string;
    phoneNumber: string;
    subcontractor: string;
}

export interface TimeEntry {
    id: string;
    userId: string;
    clockIn: string;
    clockOut: string | null;
    latitude: number;
    longitude: number;
    customer: string;
}

export interface Location {
    latitude: number;
    longitude: number;
}

export interface Customer {
    name: string;
    minLatitude: number;
    maxLatitude: number;
    minLongitude: number;
    maxLongitude: number;
} 