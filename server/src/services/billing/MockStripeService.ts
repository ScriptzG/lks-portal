import { randomUUID } from "node:crypto";
import type { BillingService } from "./BillingService.js";

/** Simulates Stripe customer/subscription creation without any network calls. */
export class MockStripeService implements BillingService {
  async createCustomer(): Promise<{ customerId: string }> {
    return { customerId: `mock_cus_${randomUUID().slice(0, 12)}` };
  }

  async createSubscription(): Promise<{
    subscriptionId: string;
    status: "trialing";
    nextBillingDate: Date;
  }> {
    const nextBillingDate = new Date();
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
    return {
      subscriptionId: `mock_sub_${randomUUID().slice(0, 12)}`,
      status: "trialing",
      nextBillingDate,
    };
  }

  async cancelSubscription(): Promise<void> {
    // no-op in mock mode
  }
}

export const billingService: BillingService = new MockStripeService();
