import { Injectable } from '@nestjs/common';

export type StripeHookEvent = { id: string; type: string; data: { object: Record<string, unknown> & { id: string } } };
type Hook = (event: StripeHookEvent) => Promise<boolean>;

/**
 * Lets other modules (the Marketplace) handle verified Stripe events without a
 * dependency cycle: they register here, and the billing webhook processor
 * offers each event to every hook after its own handling.
 */
@Injectable()
export class StripeEventHooks {
  private readonly hooks: Hook[] = [];

  register(hook: Hook) {
    this.hooks.push(hook);
  }

  async dispatch(event: StripeHookEvent) {
    let handled = false;
    for (const hook of this.hooks) handled = (await hook(event)) || handled;
    return handled;
  }
}
