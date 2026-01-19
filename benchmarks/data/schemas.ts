export interface ColumnDefinition {
  name: string
  type: 'integer' | 'float' | 'string' | 'boolean' | 'date'
  cardinality?: number // For strings, number of distinct values
  min?: number
  max?: number
}

export interface DataSchema {
  columns: ColumnDefinition[]
  seed: number
}

/**
 * Standard benchmark schema with diverse column types
 */
export const STANDARD_SCHEMA: DataSchema = {
  columns: [
    { name: 'id', type: 'integer' },
    { name: 'name', type: 'string', cardinality: 1000 },
    { name: 'value', type: 'float', min: 0, max: 10000 },
    { name: 'category', type: 'string', cardinality: 10 },
    { name: 'region', type: 'string', cardinality: 50 },
    { name: 'date', type: 'date' },
    { name: 'active', type: 'boolean' },
    { name: 'score', type: 'integer', min: 0, max: 100 },
  ],
  seed: 42,
}

/**
 * Schema for join benchmark (secondary table)
 */
export const JOIN_SCHEMA: DataSchema = {
  columns: [
    { name: 'id', type: 'integer' },
    { name: 'extra_value', type: 'float', min: 0, max: 5000 },
    { name: 'description', type: 'string', cardinality: 500 },
  ],
  seed: 123,
}

// Pre-generated string pools for deterministic data
export const CATEGORIES = [
  'Electronics',
  'Clothing',
  'Food',
  'Books',
  'Home',
  'Sports',
  'Toys',
  'Health',
  'Auto',
  'Garden',
]

export const REGIONS = [
  'North',
  'South',
  'East',
  'West',
  'Central',
  'Northeast',
  'Northwest',
  'Southeast',
  'Southwest',
  'Midwest',
  'Pacific',
  'Atlantic',
  'Mountain',
  'Plains',
  'Coastal',
  'Urban',
  'Rural',
  'Suburban',
  'Metro',
  'Regional',
  'Local',
  'National',
  'International',
  'Global',
  'Continental',
  'Oceanic',
  'Tropical',
  'Temperate',
  'Arctic',
  'Desert',
  'Forest',
  'Prairie',
  'Valley',
  'Highland',
  'Lowland',
  'Island',
  'Peninsula',
  'Delta',
  'Basin',
  'Plateau',
  'Ridge',
  'Canyon',
  'Gulf',
  'Bay',
  'Harbor',
  'Port',
  'River',
  'Lake',
  'Stream',
]

// Name parts for generating names
export const FIRST_NAMES = [
  'James',
  'Mary',
  'John',
  'Patricia',
  'Robert',
  'Jennifer',
  'Michael',
  'Linda',
  'William',
  'Elizabeth',
  'David',
  'Barbara',
  'Richard',
  'Susan',
  'Joseph',
  'Jessica',
  'Thomas',
  'Sarah',
  'Charles',
  'Karen',
]

export const LAST_NAMES = [
  'Smith',
  'Johnson',
  'Williams',
  'Brown',
  'Jones',
  'Garcia',
  'Miller',
  'Davis',
  'Rodriguez',
  'Martinez',
  'Hernandez',
  'Lopez',
  'Gonzalez',
  'Wilson',
  'Anderson',
  'Thomas',
  'Taylor',
  'Moore',
  'Jackson',
  'Martin',
  'Lee',
  'Perez',
  'Thompson',
  'White',
  'Harris',
  'Sanchez',
  'Clark',
  'Ramirez',
  'Lewis',
  'Robinson',
  'Walker',
  'Young',
  'Allen',
  'King',
  'Wright',
  'Scott',
  'Torres',
  'Nguyen',
  'Hill',
  'Flores',
  'Green',
  'Adams',
  'Nelson',
  'Baker',
  'Hall',
  'Rivera',
  'Campbell',
  'Mitchell',
  'Carter',
  'Roberts',
]
