// src/utils/periodGenerator.ts

/**
 * Utility for generating emission periods based on policy
 * Version frontend - pour daily, weekly, monthly
 */

/**
 * Get week number for ISO week date
 * @param date - The date
 * @returns Week number (1-53)
 */
function getWeekNumber(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  // Set to nearest Thursday (current date + 4 - current day number)
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/**
 * Add days to a date
 * @param date - Starting date
 * @param days - Number of days to add
 * @returns New date
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Add months to a date
 * @param date - Starting date
 * @param months - Number of months to add
 * @returns New date
 */
function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

/**
 * Get first day of month
 * @param date - Date
 * @returns First day of the month
 */
function firstDayOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * Get last day of month
 * @param date - Date in the month
 * @returns Last day of the month
 */
function lastDayOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

/**
 * Format date as YYYY-MM-DD
 * @param date - The date
 * @returns Formatted date
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Generate periods for a policy
 * @param policy - The emission policy
 * @param customEndDate - Optional custom end date
 * @returns Array of period objects
 */
export function generatePeriodsFromPolicy(
  policy: {
    frequency: 'daily' | 'weekly' | 'monthly';
    anchor_date: string;
    anchor_day?: number | null;
    project_end_date?: string;
  },
  customEndDate: string | null = null
): Array<{
  period_number: number;
  period_label: string;
  period_start: string;
  period_end: string;
  expected_at: string;
}> {
  console.log('\n📅 ===== GENERATE PERIODS FROM POLICY =====');
  console.log('Policy:', JSON.stringify(policy, null, 2));
  console.log('Custom end date:', customEndDate);

  const periods = [];
  
  // Parse dates manually to avoid timezone issues
  const [anchorYear, anchorMonth, anchorDay] = policy.anchor_date.split('-').map(Number);
  
  const endDateValue = customEndDate || policy.project_end_date;
  
  if (!endDateValue) {
    console.error('❌ No end date provided');
    return [];
  }

  const [endYear, endMonth, endDay] = endDateValue.split('-').map(Number);

  // Validate inputs
  if (isNaN(anchorYear) || isNaN(anchorMonth) || isNaN(anchorDay)) {
    console.error('❌ Invalid anchor_date:', policy.anchor_date);
    throw new Error(`Invalid anchor_date: ${policy.anchor_date}`);
  }
  if (isNaN(endYear) || isNaN(endMonth) || isNaN(endDay)) {
    console.error('❌ Invalid end date:', endDateValue);
    throw new Error(`Invalid end date: ${endDateValue}`);
  }

  // Create dates as UTC to avoid timezone shifts
  const anchorDate = new Date(Date.UTC(anchorYear, anchorMonth - 1, anchorDay));
  const endDate = new Date(Date.UTC(endYear, endMonth - 1, endDay));

  // Ensure end date is after anchor date
  if (endDate < anchorDate) {
    console.error('❌ End date must be after anchor date');
    throw new Error('End date must be after anchor date');
  }

  // Validate anchor_day based on frequency
  if (policy.frequency === 'weekly') {
    if (!policy.anchor_day) {
      throw new Error('Anchor day is required for weekly frequency');
    }
    if (policy.anchor_day < 1 || policy.anchor_day > 7) {
      throw new Error('Anchor day must be between 1 (Monday) and 7 (Sunday)');
    }
  } else if (policy.frequency === 'monthly') {
    // UPDATED: For monthly, anchor_day can be null OR 0 (special value)
    if (policy.anchor_day !== null && policy.anchor_day !== 0 && policy.anchor_day !== undefined) {
      console.warn(`⚠️ anchor_day should be null or 0 for monthly frequency, ignoring value ${policy.anchor_day}`);
    }
  } else if (policy.frequency === 'daily') {
    // For daily, anchor_day must be null
    if (policy.anchor_day !== null && policy.anchor_day !== undefined) {
      console.warn(`⚠️ anchor_day should be null for daily frequency, ignoring value ${policy.anchor_day}`);
    }
  }

  // Initialize current date based on frequency
  let currentDate: Date;
  
  switch (policy.frequency) {
    case 'monthly':
      // Pour monthly, on utilise le premier jour du mois
      currentDate = new Date(Date.UTC(anchorYear, anchorMonth - 1, 1));
      console.log(`📅 Monthly period: Starting from first day of month: ${formatDate(currentDate)}`);
      break;
    case 'weekly':
      // Pour weekly, on utilise l'anchor date ajustée au bon jour de la semaine
      currentDate = new Date(Date.UTC(anchorYear, anchorMonth - 1, anchorDay));
      // Ajuster au bon jour de la semaine si nécessaire
      if (policy.anchor_day) {
        const currentDay = currentDate.getUTCDay() || 7;
        const targetDay = policy.anchor_day;
        const diff = targetDay - currentDay;
        currentDate.setUTCDate(currentDate.getUTCDate() + diff);
      }
      break;
    case 'daily':
      // Pour daily, on utilise l'anchor date directement
      currentDate = new Date(Date.UTC(anchorYear, anchorMonth - 1, anchorDay));
      break;
    default:
      currentDate = new Date(Date.UTC(anchorYear, anchorMonth - 1, anchorDay));
  }

  console.log(`📅 Generating periods from ${formatDate(currentDate)} to ${formatDate(endDate)}`);
  console.log(`📊 Frequency: ${policy.frequency}`);

  let periodNumber = 1;
  const MAX_PERIODS = 1000;
  
  while (currentDate <= endDate && periodNumber <= MAX_PERIODS) {
    let periodStart: Date;
    let periodEnd: Date;
    let expectedDate: Date;
    let label: string;

    switch (policy.frequency) {
      case 'monthly': {
        // START: Premier jour du mois en cours
        periodStart = new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), 1));
        
        // END: Dernier jour du mois en cours
        periodEnd = new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth() + 1, 0));
        
        // EXPECTED: 5ème jour du mois suivant
        expectedDate = new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth() + 1, 5));
        
        // LABEL: YYYY-MM
        label = `${currentDate.getUTCFullYear()}-${String(currentDate.getUTCMonth() + 1).padStart(2, '0')}`;
        
        // Mois suivant
        currentDate = new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth() + 1, 1));
        break;
      }

      case 'weekly': {
        periodStart = new Date(currentDate);
        periodEnd = new Date(currentDate);
        periodEnd.setUTCDate(periodEnd.getUTCDate() + 6);
        
        expectedDate = new Date(periodEnd);
        expectedDate.setUTCDate(expectedDate.getUTCDate() + 2);
        
        const weekNumber = getWeekNumber(currentDate);
        label = `W${weekNumber}-${currentDate.getUTCFullYear()}`;
        
        // Semaine suivante
        currentDate.setUTCDate(currentDate.getUTCDate() + 7);
        break;
      }

      case 'daily': {
        periodStart = new Date(currentDate);
        periodEnd = new Date(currentDate);
        
        expectedDate = addDays(currentDate, 1);
        
        label = formatDate(currentDate);
        
        // Jour suivant
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
        break;
      }

      default:
        throw new Error(`Unknown frequency: ${policy.frequency}`);
    }

    // Ne pas ajouter la période si elle commence après la date de fin
    if (periodStart > endDate) {
      break;
    }

    // Ajouter seulement si la période se termine avant ou à la date de fin
    if (periodEnd <= endDate) {
      const period = {
        period_number: periodNumber,
        period_label: label,
        period_start: formatDate(periodStart),
        period_end: formatDate(periodEnd),
        expected_at: formatDate(expectedDate)
      };

      periods.push(period);
      periodNumber++;
    } else {
      break;
    }
  }

  console.log(`✅ Generated ${periods.length} periods`);
  if (periods.length > 0) {
    console.log('📅 First period:', periods[0]);
  }
  if (periods.length > 1) {
    console.log('📅 Second period:', periods[1]);
  }
  
  return periods;
}

/**
 * Generate period label for a specific date
 * @param date - The date
 * @param frequency - daily, weekly, monthly
 * @returns Period label
 */
export function generatePeriodLabel(date: Date, frequency: string): string {
  const d = new Date(date);
  
  switch (frequency) {
    case 'daily':
      return formatDate(d);
    case 'weekly':
      return `W${getWeekNumber(d)}-${d.getFullYear()}`;
    case 'monthly':
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    default:
      throw new Error(`Unknown frequency: ${frequency}`);
  }
}

/**
 * Calculate expected date (always after period end)
 * @param periodEnd - End date of the period
 * @param frequency - daily, weekly, monthly
 * @returns Expected date
 */
export function calculateExpectedDate(periodEnd: Date, frequency: string): Date {
  const end = new Date(periodEnd);
  
  switch (frequency) {
    case 'daily':
      return addDays(end, 1);
    case 'weekly':
      return addDays(end, 2);
    case 'monthly':
      return addDays(end, 5);
    default:
      throw new Error(`Unknown frequency: ${frequency}`);
  }
}

/**
 * Check if a period is overdue
 * @param expectedAt - Expected date (YYYY-MM-DD)
 * @param currentDate - Current date (YYYY-MM-DD) - defaults to today
 * @returns True if overdue
 */
export function isPeriodOverdue(expectedAt: string, currentDate: string | null = null): boolean {
  const today = currentDate ? new Date(currentDate) : new Date();
  const expected = new Date(expectedAt);
  
  today.setHours(0, 0, 0, 0);
  expected.setHours(0, 0, 0, 0);
  
  return today > expected;
}

/**
 * Get period status based on expected date and received flag
 * @param expectedAt - Expected date
 * @param isReceived - Whether the period has been received
 * @param currentDate - Current date - defaults to today
 * @returns Status: 'pending', 'received', 'late'
 */
export function getPeriodStatus(
  expectedAt: string,
  isReceived: boolean = false,
  currentDate: string | null = null
): 'pending' | 'received' | 'late' {
  if (isReceived) {
    return 'received';
  }
  
  const today = currentDate ? new Date(currentDate) : new Date();
  const expected = new Date(expectedAt);
  
  today.setHours(0, 0, 0, 0);
  expected.setHours(0, 0, 0, 0);
  
  if (today > expected) {
    return 'late';
  } else {
    return 'pending';
  }
}

export default {
  generatePeriodsFromPolicy,
  generatePeriodLabel,
  calculateExpectedDate,
  isPeriodOverdue,
  getPeriodStatus,
  getWeekNumber,
  addDays,
  addMonths,
  firstDayOfMonth,
  lastDayOfMonth,
  formatDate
};