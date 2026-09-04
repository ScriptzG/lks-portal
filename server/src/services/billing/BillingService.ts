export interface BillingCustomer {
  customerId: string;
}

export interface BillingSubscription {
  subscriptionId: string;
  status: "trialing" | "active" | "past_due" | "cancelled";
  nextBillingDate: Date;
}

export interface BillingService {
  createCustomer(params: { companyName: string; email: string }): Promise<BillingCustomer>;
  createSubscription(params: { customerId: string; planPriceMonthly: number }): Promise<BillingSubscription>;
  cancelSubscription(subscriptionId: string): Promise<void>;
}
