const MONTHLY_SERVICE_FEE = 60;

function calculateDaysInMonth(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();
  return new Date(year, month + 1, 0).getDate();
}

function getDaysRemainingInMonth(date = new Date()) {
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const daysRemaining = lastDay - date.getDate();
  return daysRemaining >= 0 ? daysRemaining : 0;
}

function calculateProratedFee(startDate = new Date(), isFirstMonth = true) {
  if (!isFirstMonth) {
    return MONTHLY_SERVICE_FEE;
  }

  const daysInMonth = calculateDaysInMonth(startDate);
  const daysRemaining = getDaysRemainingInMonth(startDate);

  if (daysRemaining <= 0) {
    return 0;
  }

  const dailyRate = MONTHLY_SERVICE_FEE / daysInMonth;
  const proratedFee = dailyRate * daysRemaining;

  return parseFloat(proratedFee.toFixed(2));
}

function calculateMonthlyServiceFee(loanStartDate, monthIndex = 0) {
  if (monthIndex === 0) {
    return calculateProratedFee(loanStartDate, true);
  }

  return MONTHLY_SERVICE_FEE;
}

function calculateTotalServiceFees(loanStartDate, loanTermMonths) {
  let totalFees = 0;

  for (let month = 0; month < loanTermMonths; month++) {
    const monthlyFee = calculateMonthlyServiceFee(loanStartDate, month);
    totalFees += monthlyFee;
  }

  return parseFloat(totalFees.toFixed(2));
}

function generateServiceFeeSchedule(loanStartDate, loanTermMonths) {
  const schedule = [];
  const startDate = new Date(loanStartDate);

  for (let month = 0; month < loanTermMonths; month++) {
    const paymentDate = new Date(startDate.getFullYear(), startDate.getMonth() + month + 1, 1);
    const amount = calculateMonthlyServiceFee(loanStartDate, month);

    schedule.push({
      month: month + 1,
      payment_date: paymentDate.toISOString().split('T')[0],
      amount: amount,
      is_prorated: month === 0 && amount !== MONTHLY_SERVICE_FEE
    });
  }

  return schedule;
}

function getNextServiceFeePaymentDate(currentDate = new Date()) {
  const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
  return nextMonth.toISOString().split('T')[0];
}

module.exports = {
  MONTHLY_SERVICE_FEE,
  calculateDaysInMonth,
  getDaysRemainingInMonth,
  calculateProratedFee,
  calculateMonthlyServiceFee,
  calculateTotalServiceFees,
  generateServiceFeeSchedule,
  getNextServiceFeePaymentDate
};
