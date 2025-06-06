# docs/database-schema-guide.md

## Business Logic Notes
- Tasks can have null status (means pending)
- Importance/urgency: 1-5 scale, null means not set
- All items belong to teams, not users directly
- Tags use 'color' field for visual coding

## Key Relationships
- Users → Teams (many-to-many via team_members)
- Tasks → Objectives (optional relationship)
- Tasks/Maintenance → Tags (many-to-many)

## Common Gotchas
- Remember to filter by team_id for security
- Timestamps are nullable in many tables
- User full_name can be null