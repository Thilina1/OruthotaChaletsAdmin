export const STAFF_HIERARCHY: Record<string, string[]> = {
    "Administration": [
        "admin",
        "Managing Director",
        "General Manager"
    ],
    "Office": [
        "Accountant",
        "Social Media Marketer"
    ],
    "Front Office": [
        "Receptionist",
        "Trainee Receptionist"
    ],
    "Kitchen": [
        "Head Chef",
        "Chef",
        "Cook",
        "Trainee Cook"
    ],
    "Restaurant": [
        "Restaurant Supervisor",
        "Steward",
        "Trainee Steward"
    ],
    "Housekeeping": [
        "Housekeeping supervisor",
        "Housekeeper",
        "Trainee Housekeeper",
        "Laundry Operator"
    ],
    "Garden": [
        "Gardener",
        "Pool boy / Lifeguard"
    ],
    "Maintenance": [
        "Maintenance technician"
    ],
    "Stores": [
        "Store keeper"
    ]
};

export const DEPARTMENTS = Object.keys(STAFF_HIERARCHY);
