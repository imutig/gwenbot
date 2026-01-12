// Extended list of ~200 cities worldwide with good Mapillary coverage
// Each city has coordinates and country for display

export interface GwenGuessrLocation {
    lat: number
    lng: number
    city: string
    country: string
}

export const LOCATIONS: GwenGuessrLocation[] = [
    // ============ EUROPE (20) ============
    // Sélection des capitales et hubs culturels majeurs uniquement
    { lat: 48.8566, lng: 2.3522, city: 'Paris', country: 'France' },
    { lat: 43.2965, lng: 5.3698, city: 'Marseille', country: 'France' }, // Gardé car iconique
    { lat: 51.5074, lng: -0.1278, city: 'London', country: 'UK' },
    { lat: 55.9533, lng: -3.1883, city: 'Edinburgh', country: 'UK' },
    { lat: 52.5200, lng: 13.4050, city: 'Berlin', country: 'Germany' },
    { lat: 48.1351, lng: 11.5820, city: 'Munich', country: 'Germany' },
    { lat: 41.9028, lng: 12.4964, city: 'Rome', country: 'Italy' },
    { lat: 45.4642, lng: 9.1900, city: 'Milan', country: 'Italy' },
    { lat: 40.4168, lng: -3.7038, city: 'Madrid', country: 'Spain' },
    { lat: 41.3851, lng: 2.1734, city: 'Barcelona', country: 'Spain' },
    { lat: 55.7558, lng: 37.6173, city: 'Moscow', country: 'Russia' },
    { lat: 52.3676, lng: 4.9041, city: 'Amsterdam', country: 'Netherlands' },
    { lat: 59.3293, lng: 18.0686, city: 'Stockholm', country: 'Sweden' },
    { lat: 37.9838, lng: 23.7275, city: 'Athens', country: 'Greece' },
    { lat: 38.7223, lng: -9.1393, city: 'Lisbon', country: 'Portugal' },
    { lat: 53.3498, lng: -6.2603, city: 'Dublin', country: 'Ireland' },
    { lat: 52.2297, lng: 21.0122, city: 'Warsaw', country: 'Poland' },
    { lat: 48.2082, lng: 16.3738, city: 'Vienna', country: 'Austria' },
    { lat: 50.0755, lng: 14.4378, city: 'Prague', country: 'Czech Republic' },
    { lat: 47.3769, lng: 8.5417, city: 'Zurich', country: 'Switzerland' },

    // ============ ASIA (21) ============
    { lat: 35.6762, lng: 139.6503, city: 'Tokyo', country: 'Japan' },
    { lat: 34.6937, lng: 135.5023, city: 'Osaka', country: 'Japan' },
    { lat: 39.9042, lng: 116.4074, city: 'Beijing', country: 'China' },
    { lat: 31.2304, lng: 121.4737, city: 'Shanghai', country: 'China' },
    { lat: 22.3193, lng: 114.1694, city: 'Hong Kong', country: 'Hong Kong' },
    { lat: 37.5665, lng: 126.9780, city: 'Seoul', country: 'South Korea' },
    { lat: 13.7563, lng: 100.5018, city: 'Bangkok', country: 'Thailand' },
    { lat: 1.3521, lng: 103.8198, city: 'Singapore', country: 'Singapore' },
    { lat: 21.0278, lng: 105.8342, city: 'Hanoi', country: 'Vietnam' },
    { lat: 10.8231, lng: 106.6297, city: 'Ho Chi Minh City', country: 'Vietnam' },
    { lat: -6.2088, lng: 106.8456, city: 'Jakarta', country: 'Indonesia' },
    { lat: 14.5995, lng: 120.9842, city: 'Manila', country: 'Philippines' },
    { lat: 3.1390, lng: 101.6869, city: 'Kuala Lumpur', country: 'Malaysia' },
    { lat: 28.6139, lng: 77.2090, city: 'New Delhi', country: 'India' },
    { lat: 19.0760, lng: 72.8777, city: 'Mumbai', country: 'India' },
    { lat: 12.9716, lng: 77.5946, city: 'Bangalore', country: 'India' },
    { lat: 23.8103, lng: 90.4125, city: 'Dhaka', country: 'Bangladesh' },
    { lat: 25.0330, lng: 121.5654, city: 'Taipei', country: 'Taiwan' },
    { lat: 41.3110, lng: 69.2406, city: 'Tashkent', country: 'Uzbekistan' },
    { lat: 43.2220, lng: 76.8512, city: 'Almaty', country: 'Kazakhstan' },
    { lat: 47.9184, lng: 106.9177, city: 'Ulaanbaatar', country: 'Mongolia' },

    // ============ NORTH AMERICA (18) ============
    { lat: 40.7128, lng: -74.0060, city: 'New York', country: 'USA' },
    { lat: 34.0522, lng: -118.2437, city: 'Los Angeles', country: 'USA' },
    { lat: 41.8781, lng: -87.6298, city: 'Chicago', country: 'USA' }, // Ajout important
    { lat: 25.7617, lng: -80.1918, city: 'Miami', country: 'USA' },
    { lat: 37.7749, lng: -122.4194, city: 'San Francisco', country: 'USA' },
    { lat: 47.6062, lng: -122.3321, city: 'Seattle', country: 'USA' },
    { lat: 38.9072, lng: -77.0369, city: 'Washington DC', country: 'USA' },
    { lat: 39.7392, lng: -104.9903, city: 'Denver', country: 'USA' },
    { lat: 29.7604, lng: -95.3698, city: 'Houston', country: 'USA' }, // Ajout Texas
    { lat: 21.3069, lng: -157.8583, city: 'Honolulu', country: 'USA' },
    { lat: 36.1699, lng: -115.1398, city: 'Las Vegas', country: 'USA' },
    { lat: 43.6532, lng: -79.3832, city: 'Toronto', country: 'Canada' },
    { lat: 45.5017, lng: -73.5673, city: 'Montreal', country: 'Canada' },
    { lat: 49.2827, lng: -123.1207, city: 'Vancouver', country: 'Canada' },
    { lat: 51.0447, lng: -114.0719, city: 'Calgary', country: 'Canada' },
    { lat: 45.4215, lng: -75.6972, city: 'Ottawa', country: 'Canada' },
    { lat: 46.8139, lng: -71.2080, city: 'Quebec City', country: 'Canada' },
    { lat: 19.4326, lng: -99.1332, city: 'Mexico City', country: 'Mexico' }, // Géographiquement NA, mais souvent groupé LatAm

    // ============ LATIN AMERICA (20) ============
    { lat: -23.5505, lng: -46.6333, city: 'Sao Paulo', country: 'Brazil' },
    { lat: -22.9068, lng: -43.1729, city: 'Rio de Janeiro', country: 'Brazil' },
    { lat: -15.7942, lng: -47.8822, city: 'Brasilia', country: 'Brazil' },
    { lat: -12.9777, lng: -38.5016, city: 'Salvador', country: 'Brazil' },
    { lat: -34.6037, lng: -58.3816, city: 'Buenos Aires', country: 'Argentina' },
    { lat: -31.4201, lng: -64.1888, city: 'Cordoba', country: 'Argentina' },
    { lat: -33.4489, lng: -70.6693, city: 'Santiago', country: 'Chile' },
    { lat: 4.7110, lng: -74.0721, city: 'Bogota', country: 'Colombia' },
    { lat: 6.2442, lng: -75.5812, city: 'Medellin', country: 'Colombia' },
    { lat: 10.3910, lng: -75.4794, city: 'Cartagena', country: 'Colombia' },
    { lat: -12.0464, lng: -77.0428, city: 'Lima', country: 'Peru' },
    { lat: -13.5319, lng: -71.9675, city: 'Cusco', country: 'Peru' },
    { lat: 20.6597, lng: -103.3496, city: 'Guadalajara', country: 'Mexico' },
    { lat: 23.1136, lng: -82.3666, city: 'Havana', country: 'Cuba' },
    { lat: 8.9824, lng: -79.5199, city: 'Panama City', country: 'Panama' },
    { lat: 9.9281, lng: -84.0907, city: 'San Jose', country: 'Costa Rica' },
    { lat: -0.1807, lng: -78.4678, city: 'Quito', country: 'Ecuador' },
    { lat: -34.9011, lng: -56.1645, city: 'Montevideo', country: 'Uruguay' },
    { lat: -16.4897, lng: -68.1193, city: 'La Paz', country: 'Bolivia' },
    { lat: 10.4806, lng: -66.9036, city: 'Caracas', country: 'Venezuela' },

    // ============ AFRICA (19) ============
    { lat: 30.0444, lng: 31.2357, city: 'Cairo', country: 'Egypt' },
    { lat: 31.2001, lng: 29.9187, city: 'Alexandria', country: 'Egypt' },
    { lat: -33.9249, lng: 18.4241, city: 'Cape Town', country: 'South Africa' },
    { lat: -26.2041, lng: 28.0473, city: 'Johannesburg', country: 'South Africa' },
    { lat: 6.5244, lng: 3.3792, city: 'Lagos', country: 'Nigeria' },
    { lat: 5.6037, lng: -0.1870, city: 'Accra', country: 'Ghana' },
    { lat: 14.6928, lng: -17.4467, city: 'Dakar', country: 'Senegal' },
    { lat: 5.3600, lng: -4.0083, city: 'Abidjan', country: 'Ivory Coast' },
    { lat: -1.2921, lng: 36.8219, city: 'Nairobi', country: 'Kenya' },
    { lat: 9.0054, lng: 38.7636, city: 'Addis Ababa', country: 'Ethiopia' },
    { lat: -6.7924, lng: 39.2083, city: 'Dar es Salaam', country: 'Tanzania' },
    { lat: -1.9441, lng: 30.0619, city: 'Kigali', country: 'Rwanda' },
    { lat: 33.5731, lng: -7.5898, city: 'Casablanca', country: 'Morocco' },
    { lat: 31.6295, lng: -7.9811, city: 'Marrakech', country: 'Morocco' },
    { lat: 36.8065, lng: 10.1815, city: 'Tunis', country: 'Tunisia' },
    { lat: -25.9692, lng: 32.5732, city: 'Maputo', country: 'Mozambique' },
    { lat: -18.9137, lng: 47.5005, city: 'Antananarivo', country: 'Madagascar' },
    { lat: -8.8390, lng: 13.2894, city: 'Luanda', country: 'Angola' },
    { lat: -22.5609, lng: 17.0658, city: 'Windhoek', country: 'Namibia' },

    // ============ MIDDLE EAST (10) ============
    { lat: 25.2048, lng: 55.2708, city: 'Dubai', country: 'UAE' },
    { lat: 24.4539, lng: 54.3773, city: 'Abu Dhabi', country: 'UAE' },
    { lat: 32.0853, lng: 34.7818, city: 'Tel Aviv', country: 'Israel' },
    { lat: 24.7136, lng: 46.6753, city: 'Riyadh', country: 'Saudi Arabia' },
    { lat: 21.4858, lng: 39.1925, city: 'Jeddah', country: 'Saudi Arabia' },
    { lat: 25.2854, lng: 51.5310, city: 'Doha', country: 'Qatar' },
    { lat: 33.8886, lng: 35.4955, city: 'Beirut', country: 'Lebanon' },
    { lat: 31.9454, lng: 35.9284, city: 'Amman', country: 'Jordan' },
    { lat: 29.3759, lng: 47.9774, city: 'Kuwait City', country: 'Kuwait' },
    { lat: 23.5880, lng: 58.3829, city: 'Muscat', country: 'Oman' },

    // ============ OCEANIA (9) ============
    { lat: -33.8688, lng: 151.2093, city: 'Sydney', country: 'Australia' },
    { lat: -37.8136, lng: 144.9631, city: 'Melbourne', country: 'Australia' },
    { lat: -27.4698, lng: 153.0251, city: 'Brisbane', country: 'Australia' },
    { lat: -31.9505, lng: 115.8605, city: 'Perth', country: 'Australia' },
    { lat: -36.8509, lng: 174.7645, city: 'Auckland', country: 'New Zealand' },
    { lat: -41.2865, lng: 174.7762, city: 'Wellington', country: 'New Zealand' },
    { lat: -43.5321, lng: 172.6362, city: 'Christchurch', country: 'New Zealand' },
    { lat: -18.1248, lng: 178.4501, city: 'Suva', country: 'Fiji' },
    { lat: -9.4438, lng: 147.1803, city: 'Port Moresby', country: 'Papua New Guinea' },
];

// Get a random location from the list
export function getRandomLocation(): GwenGuessrLocation {
    return LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)]
}
