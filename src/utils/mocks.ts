import {Device, RecentFile, UserType} from "@/types.ts";

export const mockUsersData: UserType[] = [
    {
        id: "User-123",
        name: "John Doe",
        gender: "Male",
        age: 30,
        height: 180,
        heightMetric: "cm",
        handedness: "Right",
        weight: 75,
        weightMetric: "kg",
        color: "#3498db",
        createdAt: "2025-06-10T10:00:00Z",
        updatedAt: "2025-06-15T10:00:00Z",
        submitted: true
    },
    {
        id: "User-456",
        name: "Jane Smith",
        gender: "Female",
        age: 28,
        height: 165,
        heightMetric: "cm",
        handedness: "Left",
        weight: 60,
        weightMetric: "kg",
        color: "#e74c3c",
        createdAt: "2025-06-09T14:30:00Z",
        updatedAt: "2025-06-14T14:30:00Z",
        submitted: true
    },
    {
        id: "User-789",
        name: "Alex Green",
        gender: "Other",
        customGender: "Non-binary",
        age: 35,
        height: 67,
        heightMetric: "in",
        handedness: "Ambidextrous",
        weight: 150,
        weightMetric: "lb",
        color: "#2ecc71",
        createdAt: "2025-06-08T09:15:00Z",
        updatedAt: "2025-06-13T09:15:00Z",
        submitted: true
    },
];

export const mockDeviceData: Device[] = [
    { id: 1, name: "Nintendo RVL-WBC-01", status: "Connected", mac: "00:1A:7D:DA:71:13", battery: 85, temperature: 22, firmware: "v1.2.3", lastConnected: "2023-10-01T10:00:00Z" },
    { id: 2, name: "Nintendo RVL-WBC-02", status: "Connected", mac: "00:1A:7D:DA:71:14", battery: 26, temperature: 23, firmware: "v1.2.4", lastConnected: "2023-10-05T11:00:00Z" },
    { id: 3, name: "Generic Board X", status: "Disconnected", mac: "00:1A:7D:DA:71:15", battery: 0, temperature: 20, firmware: "v1.0.0", lastConnected: "2023-09-15T12:00:00Z" },
];

export const mockScanDeviceData: Device[] = [
    { id: 1, name: "Nintendo RVL-WBC-01", status: "Connected", mac: "00:1A:7D:DA:71:13", battery: 88, temperature: 23, firmware: "v1.2.3", lastConnected: new Date().toISOString() },
    { id: 4, name: "New Board Alpha", status: "Active", mac: "00:1A:7D:DA:71:A4", battery: 75, temperature: 21, firmware: "v1.0.0", lastConnected: new Date().toISOString() },
]

export const mockRecentFiles: RecentFile[] = [
    { id: '1', name: 'Session_2025-06-12_Alpha.csv', location: 'Documents/BalanceToolkit/Sessions', lastUpdated: 'June 12, 2025', userName: 'User-123' },
    { id: '2', name: 'PatientReport_JohnDoe.pdf', location: 'Desktop/Reports', lastUpdated: 'June 11, 2025', userName: 'Dr. Emily' },
    { id: '3', name: 'ExercisePlan_Week5.docx', location: 'OneDrive/ClientFiles/JaneS', lastUpdated: 'June 10, 2025', userName: 'User-123' },
    { id: '4', name: 'System_Calibration_Log.txt', location: 'C:/ProgramData/BalanceToolkit', lastUpdated: 'June 9, 2025', userName: 'Admin' },
    { id: '5', name: 'ResearchData_StudyGamma.xlsx', location: 'SharedDrives/Research/FY2025', lastUpdated: 'June 8, 2025', userName: 'Dr. Smith' },
    { id: '6', name: 'MeetingNotes_ProjectPhoenix.md', location: 'Documents/Projects/Phoenix', lastUpdated: 'June 7, 2025', userName: 'User-456' },
    { id: '7', name: 'SoftwareUpdate_v2.3_Changelog.txt', location: 'Downloads/Software', lastUpdated: 'June 6, 2025', userName: 'DevTeam' },
    { id: '8', name: 'ClientFeedback_Q2_Summary.pptx', location: 'OneDrive/ClientPresentations', lastUpdated: 'June 5, 2025', userName: 'SalesTeam' },
    { id: '9', name: 'TrainingManual_NewStaff.pdf', location: 'CompanyPortal/HR/Onboarding', lastUpdated: 'June 4, 2025', userName: 'HR Dept' },
    { id: '10', name: 'Session_2025-06-03_Beta.csv', location: 'Documents/BalanceToolkit/Archive', lastUpdated: 'June 3, 2025', userName: 'User-123' },
    { id: '11', name: 'FinancialReport_May2025.pdf', location: 'Secure/Finance/MonthlyReports', lastUpdated: 'June 2, 2025', userName: 'FinanceLead' },
    { id: '12', name: 'MarketingCampaign_Summer25.ai', location: 'Marketing/Assets/Campaigns', lastUpdated: 'June 1, 2025', userName: 'MarketingGuru' },
    { id: '13', name: 'UserSurvey_Results_May.csv', location: 'Analytics/UserFeedback', lastUpdated: 'May 31, 2025', userName: 'DataAnalyst' },
    { id: '14', name: 'Backup_SystemConfig_2025-05-30.zip', location: 'D:/Backups/System', lastUpdated: 'May 30, 2025', userName: 'Admin' },
];