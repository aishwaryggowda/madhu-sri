export interface Hive {
  id: string;
  name: string;
  ownerName: string;
  latitude: number;
  longitude: number;
  honeyProductionKg: number;
  healthStatus: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  coverStatus: 'Open' | 'Closed';
  closedAt?: string; // ISO String
  lastInspected: string;
}

export interface SprayAlert {
  id: string;
  chemicalName: string;
  farmerName: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
  timestamp: string; // ISO String
  durationMinutes: number;
  active: boolean;
}

export interface HealthLog {
  id: string;
  hiveId: string;
  date: string; // YYYY-MM-DD
  weightKg: number;
  honeyHarvestedKg: number;
  queenSeen: boolean;
  activityLevel: 'High' | 'Medium' | 'Low';
  healthStatus: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  notes: string;
}

export interface PesticideAnalysis {
  chemicalName: string;
  safetyLevel: 'Safe' | 'Moderately Toxic' | 'Highly Toxic';
  riskScore: number; // 1-10
  description: string;
  precautions: string[];
  safeAlternatives: string[];
  foragingImpact: string;
}
