export class DomainError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: Record<string, any>;

  constructor(message: string, statusCode = 400, code = "DOMAIN_ERROR", details?: Record<string, any>) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, fields?: Record<string, string>) {
    super(message, 422, "VALIDATION_ERROR", fields);
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = "Authentication required to access this resource") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = "You do not have permission to perform this action") {
    super(message, 403, "FORBIDDEN");
  }
}

export class NotFoundError extends DomainError {
  constructor(message = "Requested resource was not found") {
    super(message, 404, "NOT_FOUND");
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super(message, 409, "CONFLICT");
  }
}

export class AccountLockedError extends DomainError {
  constructor(message = "Account is temporarily locked due to multiple failed login attempts. Please try again later.") {
    super(message, 429, "ACCOUNT_LOCKED");
  }
}

export class AccountSuspendedError extends DomainError {
  constructor(message = "Account has been suspended by administration. Please contact support.") {
    super(message, 403, "ACCOUNT_SUSPENDED");
  }
}

export class PaymentProviderNotConfiguredError extends DomainError {
  constructor(message = "Payment provider is not configured. Real financial operations cannot proceed.") {
    super(message, 503, "PAYMENT_PROVIDER_NOT_CONFIGURED");
  }
}

export class InvalidPaymentStateError extends DomainError {
  constructor(message: string) {
    super(message, 422, "INVALID_PAYMENT_STATE");
  }
}

export class PaymentAmountMismatchError extends DomainError {
  constructor(message = "Payment amount does not match authoritative agreed transaction amount.") {
    super(message, 422, "PAYMENT_AMOUNT_MISMATCH");
  }
}

export class PaymentCurrencyMismatchError extends DomainError {
  constructor(message = "Unsupported currency. Transaction must be denominated in INR.") {
    super(message, 422, "PAYMENT_CURRENCY_MISMATCH");
  }
}

export class InvalidWebhookError extends DomainError {
  constructor(message = "Invalid or unverified webhook signature.") {
    super(message, 401, "INVALID_WEBHOOK");
  }
}

export class WebhookReplayError extends DomainError {
  constructor(message = "Webhook event has already been processed.") {
    super(message, 200, "WEBHOOK_REPLAY");
  }
}

export class IdempotencyConflictError extends DomainError {
  constructor(message = "Idempotency key collision with different request payload.") {
    super(message, 409, "IDEMPOTENCY_CONFLICT");
  }
}

export class DiligenceCaseClosedError extends DomainError {
  constructor(message = "Due diligence case is closed and cannot accept new actions.") {
    super(message, 400, "DILIGENCE_CASE_CLOSED");
  }
}

export class DiligenceGateError extends DomainError {
  constructor(message = "Due diligence prerequisites (Accepted MOU, Executed NDA, Confirmed Token Deposit) are not satisfied.") {
    super(message, 403, "DILIGENCE_GATE_BLOCKED");
  }
}

export class InvalidDiligenceStateError extends DomainError {
  constructor(message = "Invalid state transition for due diligence workflow.") {
    super(message, 400, "INVALID_DILIGENCE_STATE");
  }
}

export class ValuationGateError extends DomainError {
  constructor(message = "Valuation prerequisites (Eligible Due Diligence Case, Accepted MOU, Executed NDA, Confirmed Escrow Deposit) are not satisfied.") {
    super(message, 403, "VALUATION_GATE_BLOCKED");
  }
}

export class InvalidValuationStateError extends DomainError {
  constructor(message = "Invalid state transition for valuation workflow.") {
    super(message, 400, "INVALID_VALUATION_STATE");
  }
}

export class ValuationLockedError extends DomainError {
  constructor(message = "Valuation version is locked and immutable. Direct changes are prohibited; create a new version.") {
    super(message, 400, "VALUATION_LOCKED");
  }
}

export class CalculationError extends DomainError {
  constructor(message = "Valuation calculation failed due to invalid financial inputs or mathematical constraints.") {
    super(message, 422, "CALCULATION_ERROR");
  }
}

export class TransactionGateError extends DomainError {
  constructor(message = "Transaction prerequisites (Published Opportunity, Executed NDA, Accepted MOU, Confirmed Escrow Deposit, Completed Diligence, Approved Valuation) are not satisfied.") {
    super(message, 403, "TRANSACTION_GATE_BLOCKED");
  }
}

export class InvalidTransactionStateError extends DomainError {
  constructor(message = "Invalid state transition for transaction deal room workflow.") {
    super(message, 400, "INVALID_TRANSACTION_STATE");
  }
}

export class TransactionClosedError extends DomainError {
  constructor(message = "Transaction is already closed and immutable. Historical deal records cannot be mutated.") {
    super(message, 400, "TRANSACTION_CLOSED");
  }
}

export class ClosingConditionUnsatisfiedError extends DomainError {
  constructor(message = "One or more mandatory closing conditions are not satisfied. Transaction cannot be closed.") {
    super(message, 422, "CLOSING_CONDITION_UNSATISFIED");
  }
}

export class TermsConflictError extends DomainError {
  constructor(message = "Transaction terms conflict with authoritative accepted MOU or approved valuation.") {
    super(message, 422, "TERMS_CONFLICT");
  }
}

export class NotificationNotFoundError extends DomainError {
  constructor(message = "Notification not found or access unauthorized.") {
    super(message, 404, "NOTIFICATION_NOT_FOUND");
  }
}

export class MandatoryNotificationError extends DomainError {
  constructor(message = "Mandatory security or transactional notifications cannot be disabled.") {
    super(message, 422, "MANDATORY_NOTIFICATION_CANNOT_BE_DISABLED");
  }
}

export class EmailProviderNotConfiguredError extends DomainError {
  constructor(message = "Email provider is not configured. Live outbound email delivery cannot proceed.") {
    super(message, 503, "EMAIL_PROVIDER_NOT_CONFIGURED");
  }
}

export class NotificationDeliveryFailedError extends DomainError {
  constructor(message = "Notification delivery failed after multiple retry attempts.") {
    super(message, 500, "NOTIFICATION_DELIVERY_FAILED");
  }
}

export class NotificationRateLimitError extends DomainError {
  constructor(message = "Too many notification requests. Please slow down.") {
    super(message, 429, "NOTIFICATION_RATE_LIMIT_EXCEEDED");
  }
}


