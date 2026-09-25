const PAYMENT_BATCH_WINDOW_MS = 10 * 60 * 1000;

const timestamp = (payment) => {
  const value = new Date(payment.created_at).getTime();
  return Number.isFinite(value) ? value : null;
};

const samePaymentContext = (left, right) =>
  left.student_id === right.student_id &&
  left.created_by_user_id === right.created_by_user_id &&
  left.payment_date === right.payment_date;

// The Maarif API stores one monthly payment per monthly due and has no batch ID.
// Treat nearby records from the same student/user/date as one checkout only for
// presentation and receipt printing; the original payment records remain intact.
export function groupRelatedMonthlyPayments(payments, windowMs = PAYMENT_BATCH_WINDOW_MS) {
  const sorted = [...payments].sort((a, b) => {
    const timeDifference = (timestamp(b) || 0) - (timestamp(a) || 0);
    return timeDifference || Number(b.id || 0) - Number(a.id || 0);
  });
  const groups = [];

  sorted.forEach((payment) => {
    const paymentTime = timestamp(payment);
    const match = groups.find((group) => {
      const anchor = group.payments[0];
      const anchorTime = timestamp(anchor);
      return (
        paymentTime !== null &&
        anchorTime !== null &&
        samePaymentContext(payment, anchor) &&
        Math.abs(anchorTime - paymentTime) <= windowMs
      );
    });

    if (match) match.payments.push(payment);
    else groups.push({ payments: [payment] });
  });

  return groups.map((group) => {
    const orderedPayments = group.payments.sort(
      (a, b) => Number(a.sequence || 0) - Number(b.sequence || 0),
    );
    return {
      key: orderedPayments.map((payment) => payment.id).join("-"),
      payments: orderedPayments,
      firstPayment: orderedPayments.reduce((latest, payment) =>
        (timestamp(payment) || 0) > (timestamp(latest) || 0) ? payment : latest,
      ),
      totalAmount: orderedPayments.reduce(
        (total, payment) => total + Number(payment.amount || 0),
        0,
      ),
    };
  });
}
