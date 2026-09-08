import { createLogger } from "@gdp/core";
import type { CreditTransaction, CreditWallet } from "@gdp/core";
import { packRepository } from "./pack-repository.js";
import { trackEvent } from "./analytics.js";

const log = createLogger("wallet-service");

export class WalletService {
  async getWallet(userId: string): Promise<CreditWallet> {
    return packRepository.getOrCreateWallet(userId);
  }

  async getTransactions(userId: string): Promise<CreditTransaction[]> {
    return packRepository.getCreditTransactions(userId);
  }

  /**
   * Idempotently grants credits purchased via an order.
   * Prevents double crediting from duplicate webhooks.
   */
  async grantCreditsFromOrder(params: {
    userId: string;
    orderId: string;
    credits: number;
    description?: string;
  }): Promise<CreditWallet> {
    const { userId, orderId, credits, description } = params;
    log.info("Granting credits from order", { userId, orderId, credits });

    const result = await packRepository.transactCredit({
      userId,
      type: "purchase",
      amount: credits,
      referenceType: "order",
      referenceId: orderId,
      description: description || `Purchased ${credits} design credit${credits > 1 ? "s" : ""}`,
    });

    if (result.transaction) {
      await trackEvent({
        type: "credit_purchase",
        userId,
        payload: {
          orderId,
          credits,
          balanceAfter: result.wallet.balance,
        },
      });
    }

    return result.wallet;
  }

  /**
   * Atomically consumes 1 credit to unlock and package a pack.
   */
  async consumeCreditForPack(params: {
    userId: string;
    packId: string;
  }): Promise<{ success: boolean; error?: string }> {
    const { userId, packId } = params;
    const result = await packRepository.transactCredit({
      userId,
      type: "consumption",
      amount: -1,
      referenceType: "pack",
      referenceId: packId,
      description: `Unlocked promo pack ${packId}`,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    await trackEvent({
      type: "credit_consumed",
      userId,
      packId,
      payload: {
        credits: 1,
        balanceAfter: result.wallet.balance,
        action: "unlock_pack",
      },
    });

    return { success: true };
  }

  /**
   * Atomically consumes 1 credit for a natural-language detail edit & regeneration.
   */
  async consumeCreditForEdit(params: {
    userId: string;
    packId: string;
    description: string;
  }): Promise<{ success: boolean; error?: string; txId?: string }> {
    const { userId, packId, description } = params;
    const result = await packRepository.transactCredit({
      userId,
      type: "consumption",
      amount: -1,
      referenceType: "edit",
      referenceId: packId,
      description: `Regeneration: ${description}`,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    await trackEvent({
      type: "credit_consumed",
      userId,
      packId,
      payload: {
        credits: 1,
        balanceAfter: result.wallet.balance,
        action: "edit_regeneration",
        description,
      },
    });

    return { success: true, txId: result.transaction?.id };
  }

  /**
   * Restores/refunds credit if asset regeneration or packaging fails after credit reservation.
   */
  async refundCreditForFailedEdit(params: {
    userId: string;
    packId: string;
    reason: string;
  }): Promise<void> {
    const { userId, packId, reason } = params;
    log.warn("Refunding credit for failed edit", { userId, packId, reason });

    const result = await packRepository.transactCredit({
      userId,
      type: "refund",
      amount: 1,
      referenceType: "edit",
      referenceId: packId,
      description: `Refund: ${reason}`,
    });

    await trackEvent({
      type: "credit_refunded",
      userId,
      packId,
      payload: {
        credits: 1,
        balanceAfter: result.wallet.balance,
        reason,
      },
    });
  }
}

export const walletService = new WalletService();
