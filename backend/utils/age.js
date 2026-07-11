// Shared age-calculation helpers — single source of truth so the "13" and
// "18" cutoffs can't drift out of sync across authController/middleware/etc.

const getAge = (dateOfBirth) => {
  if (!dateOfBirth) return null;
  return Math.floor((Date.now() - new Date(dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000));
};

const isUnder13 = (dateOfBirth) => {
  const age = getAge(dateOfBirth);
  return age === null ? false : age < 13;
};

// Fail-closed default: missing/invalid DOB => NOT an adult, so mature
// content stays hidden rather than leaking to an unverified age. This
// matters for pre-existing accounts created before dateOfBirth was required.
const isAdult = (dateOfBirth) => {
  const age = getAge(dateOfBirth);
  return age !== null && age >= 18;
};

module.exports = { getAge, isUnder13, isAdult };