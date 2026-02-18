/**
 * Shortens player role names for better mobile display
 * @param {string} role - Full role name
 * @returns {string} - Shortened role name
 */
export function shortenRole(role) {
  if (!role) return '';
  
  const roleMap = {
    'Batsman': 'Bat',
    'Batter': 'Bat',
    'Bowler': 'Bowl',
    'All-rounder': 'AR',
    'Allrounder': 'AR',
    'All Rounder': 'AR',
    'Wicket-keeper': 'WK',
    'Wicketkeeper': 'WK',
    'Wicket Keeper': 'WK',
    'WK-Batsman': 'WK-Bat',
    'WK Batsman': 'WK-Bat',
  };
  
  // Check for exact match first
  if (roleMap[role]) {
    return roleMap[role];
  }
  
  // Check for case-insensitive match
  const lowerRole = role.toLowerCase();
  for (const [key, value] of Object.entries(roleMap)) {
    if (key.toLowerCase() === lowerRole) {
      return value;
    }
  }
  
  // Return original if no match found
  return role;
}
