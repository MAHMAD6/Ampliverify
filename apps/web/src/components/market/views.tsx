import Link from 'next/link';
import { Badge, ButtonLink, DataTable, Field, Input, KeyValue, PageHeader, Panel, Textarea } from '../ui';
import { ActionButton, ApiForm } from '../ui/actions';
import { formatDateTime } from '@/lib/format';
import { type Deal, DEAL_STATUS, INTRO_STATUS, INQUIRY_STATUS, money, type Offer, OFFER_STATUS, type Thread } from '@/lib/marketplace';
import { MinorForm, NoteAction } from './forms';
import { DealStages, StatusBadge } from './parts';
import m from './market.module.css';

/** Inquiry / introduction thread, shared by buyer and seller (participants only; enforced by the API). */
export function ThreadView({ t, base }: { t: Thread; base: '/buyer' | '/seller' }) {
  const isSeller = t.role === 'SELLER';
  const openOffer = t.offers.find((o) => ['SUBMITTED', 'COUNTERED', 'ACCEPTED'].includes(o.status));
  return (
    <>
      <PageHeader
        title={t.listing.title}
        description={`${isSeller ? 'Inquiry from' : 'Conversation with'} ${t.counterpart} · started ${formatDateTime(t.createdAt)}`}
        crumbs={[{ label: isSeller ? 'Received Inquiries' : 'My Inquiries', href: `${base}/inquiries` }, { label: t.listing.title }]}
        actions={
          <div className={m.actions}>
            <StatusBadge map={INTRO_STATUS} value={t.introStatus} />
            <StatusBadge map={INQUIRY_STATUS} value={t.status} />
          </div>
        }
      />
      <div className={m.two}>
        <div className={m.stack}>
          <Panel title={t.listing.kind === 'BUSINESS' ? 'Introduction request' : 'Question'}>
            <p className={m.prose}>{t.message}</p>
            {(t.buyerRole || t.budget) && (
              <div style={{ marginTop: 10 }}>
                {t.buyerRole && <KeyValue label="Buyer type" value={t.buyerRole} />}
                {t.budget && <KeyValue label="Budget" value={t.budget} />}
              </div>
            )}
          </Panel>
          {isSeller && t.introStatus === 'PENDING' && (
            <Panel title="Respond to this introduction" description="Messaging and offers open only after you accept. Contact details are never shared automatically.">
              <ApiForm path={`/user/marketplace/inquiries/${t.id}/introduction`} extra={{ decision: 'APPROVE' }} submitLabel="Accept introduction" successMessage="Introduction accepted. The buyer can now message you.">
                <Field label="Message to the buyer (optional)" htmlFor="intro-msg">
                  <Textarea id="intro-msg" name="message" maxLength={4000} rows={3} />
                </Field>
              </ApiForm>
              <div style={{ marginTop: 10 }}>
                <NoteAction path={`/user/marketplace/inquiries/${t.id}/introduction`} body={{ decision: 'DECLINE' }} noteField="message" label="Decline" required={false} placeholder="Optional note to the buyer" successMessage="Introduction declined." />
              </div>
            </Panel>
          )}
          <Panel title="Messages">
            {t.messages.length === 0 ? (
              <p className={m.muted}>{t.canMessage ? 'No messages yet. Start the conversation below.' : t.introStatus === 'PENDING' ? 'Messaging opens once the seller accepts the introduction.' : 'This conversation is closed.'}</p>
            ) : (
              <div className={m.thread}>
                {t.messages.map((msg) => (
                  <div key={msg.id} className={`${m.bubble} ${msg.mine ? m.bubbleMine : ''}`}>
                    <small>
                      {msg.mine ? 'You' : t.counterpart} · {formatDateTime(msg.createdAt)}
                    </small>
                    {msg.body}
                  </div>
                ))}
              </div>
            )}
            {t.canMessage && (
              <div style={{ marginTop: 14 }}>
                <ApiForm path={`/user/marketplace/inquiries/${t.id}/messages`} submitLabel="Send message" successMessage="Message sent." resetOnSuccess>
                  <Field label="Your message" htmlFor="thread-msg" hint="Keep payments and agreements on AmpliVerify. Never share passwords here.">
                    <Textarea id="thread-msg" name="message" required maxLength={4000} rows={3} />
                  </Field>
                </ApiForm>
              </div>
            )}
          </Panel>
        </div>
        <div className={m.stack}>
          <Panel title="Listing">
            <KeyValue label="Asking price" value={money(t.listing.askingPriceMinor, t.listing.currency)} />
            <KeyValue label="Type" value={t.listing.kind === 'BUSINESS' ? 'Business acquisition' : 'Digital product'} />
            <div className={m.actions} style={{ marginTop: 10 }}>
              <ButtonLink href={`/buyer/listings/${t.listing.id}`} variant="outline" size="sm">
                View listing
              </ButtonLink>
            </div>
          </Panel>
          {t.listing.kind === 'BUSINESS' && (
            <Panel title="Offers">
              {t.offers.length === 0 ? (
                <p className={m.muted}>{!isSeller && t.canMessage ? 'Ready to make an offer? Offers are versioned, so both sides always see the latest terms.' : 'No offers yet.'}</p>
              ) : (
                <ul className={m.list}>
                  {t.offers.map((o) => (
                    <li key={o.id}>
                      <Link href={`${base}/offers/${o.id}`}>{money(o.amountMinor, o.currency)}</Link> · <StatusBadge map={OFFER_STATUS} value={o.status} />
                    </li>
                  ))}
                </ul>
              )}
              {!isSeller && t.canMessage && !openOffer && (
                <div style={{ marginTop: 12 }}>
                  <MinorForm path={`/user/marketplace/listings/${t.listing.id}/offers`} minorFields={['amountMinor']} submitLabel="Submit offer" successMessage="Offer sent to the seller." redirectTo="/buyer/offers/{id}">
                    <Field label={`Offer amount (${t.listing.currency})`} htmlFor="offer-amt">
                      <Input id="offer-amt" name="amountMinor" data-type="number" type="number" min={1} step="0.01" required />
                    </Field>
                    <Field label="Terms (optional)" htmlFor="offer-terms" hint="Payment method, timing, what is included, conditions.">
                      <Textarea id="offer-terms" name="terms" maxLength={4000} rows={3} />
                    </Field>
                  </MinorForm>
                </div>
              )}
            </Panel>
          )}
          {t.status !== 'CLOSED' && (
            <Panel title="Close conversation">
              <ActionButton path={`/user/marketplace/inquiries/${t.id}/close`} variant="outline" size="sm" confirm="Close this conversation? Neither side can send new messages." successMessage="Conversation closed.">
                Close conversation
              </ActionButton>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}

const ACTION_LABEL: Record<string, string> = { SUBMIT: 'Offer submitted', COUNTER: 'Counteroffer', ACCEPT: 'Accepted', DECLINE: 'Declined', WITHDRAW: 'Withdrawn' };

/** Offer with its immutable revision history; every move carries the version the user saw (stale moves are rejected). */
export function OfferView({ o, base }: { o: Offer; base: '/buyer' | '/seller' }) {
  const open = o.status === 'SUBMITTED' || o.status === 'COUNTERED';
  return (
    <>
      <PageHeader
        title={`Offer on ${o.listing.title}`}
        description={`${money(o.amountMinor, o.currency)} · version ${o.version} · updated ${formatDateTime(o.updatedAt)}`}
        crumbs={[{ label: base === '/buyer' ? 'My Offers' : 'Offers & Negotiations', href: `${base}/offers` }, { label: o.listing.title }]}
        actions={<StatusBadge map={OFFER_STATUS} value={o.status} />}
      />
      <div className={m.two}>
        <div className={m.stack}>
          <Panel title="Current terms">
            <KeyValue label="Amount" value={money(o.amountMinor, o.currency)} />
            <KeyValue label="Terms" value={o.terms ?? '—'} />
            {open && (o.awaitingMe ? <p className={m.muted}>Waiting for your response.</p> : <p className={m.muted}>Waiting for the other party to respond.</p>)}
            {o.transaction && (
              <div className={m.actions} style={{ marginTop: 10 }}>
                <ButtonLink href={`${base}/transactions/${o.transaction.id}`} size="sm">
                  Open transaction
                </ButtonLink>
                <StatusBadge map={DEAL_STATUS} value={o.transaction.status} />
              </div>
            )}
          </Panel>
          {open && o.awaitingMe && (
            <Panel title="Respond" description="Accepting opens a tracked transaction: agreement, due diligence and transfer.">
              <div className={m.actions}>
                <ActionButton path={`/user/marketplace/offers/${o.id}`} body={{ action: 'ACCEPT', expectedVersion: o.version }} confirm={`Accept ${money(o.amountMinor, o.currency)}?`} successMessage="Offer accepted.">
                  Accept offer
                </ActionButton>
                <ActionButton path={`/user/marketplace/offers/${o.id}`} body={{ action: 'DECLINE', expectedVersion: o.version }} variant="outline" confirm="Decline this offer?" successMessage="Offer declined.">
                  Decline
                </ActionButton>
              </div>
              <div style={{ marginTop: 14 }}>
                <MinorForm path={`/user/marketplace/offers/${o.id}`} extra={{ action: 'COUNTER', expectedVersion: o.version }} minorFields={['amountMinor']} submitLabel="Send counteroffer" submitVariant="outline" successMessage="Counteroffer sent.">
                  <Field label={`Counter amount (${o.currency})`} htmlFor="counter-amt">
                    <Input id="counter-amt" name="amountMinor" data-type="number" type="number" min={1} step="0.01" required />
                  </Field>
                  <Field label="Terms (optional)" htmlFor="counter-terms">
                    <Textarea id="counter-terms" name="terms" maxLength={4000} rows={3} defaultValue={o.terms ?? ''} />
                  </Field>
                </MinorForm>
              </div>
            </Panel>
          )}
          {open && !o.awaitingMe && (
            <Panel title="Withdraw">
              <ActionButton path={`/user/marketplace/offers/${o.id}`} body={{ action: 'WITHDRAW', expectedVersion: o.version }} variant="outline" confirm="Withdraw your latest terms?" successMessage="Offer withdrawn.">
                Withdraw my terms
              </ActionButton>
            </Panel>
          )}
        </div>
        <Panel title="History">
          <DataTable
            columns={['Version', 'Event', 'Amount', 'By', 'When']}
            rows={o.history.map((h) => [h.version, ACTION_LABEL[h.action] ?? h.action, money(h.amountMinor, o.currency), h.byMe ? 'You' : 'Other party', formatDateTime(h.createdAt)])}
          />
          <p className={m.muted} style={{ marginTop: 8 }}>
            <Link href={`${base}/inquiries/${o.inquiryId}`}>Open the conversation</Link>
          </p>
        </Panel>
      </div>
    </>
  );
}

/** Acquisition transaction tracking. AmpliVerify does not hold acquisition funds and never marks an asset owned from this alone. */
export function DealView({ d, base }: { d: Deal; base: '/buyer' | '/seller' }) {
  const isBuyer = d.role === 'BUYER';
  const active = ['AGREEMENT_PENDING', 'DUE_DILIGENCE', 'TRANSFER_IN_PROGRESS'].includes(d.status);
  const iAgreed = isBuyer ? d.buyerAgreedAt : d.sellerAgreedAt;
  return (
    <>
      <PageHeader
        title={d.listing.title}
        description={`Acquisition · ${money(d.amountMinor, d.currency)} · opened ${formatDateTime(d.createdAt)}`}
        crumbs={[{ label: 'Transactions', href: `${base}/transactions` }, { label: d.listing.title }]}
        actions={<StatusBadge map={DEAL_STATUS} value={d.status} />}
      />
      <div className={m.stack}>
        <Panel title="Progress">
          <DealStages status={d.status} />
        </Panel>
        <div className={m.two}>
          <div className={m.stack}>
            {active && (
              <Panel title="Next step">
                {d.status === 'AGREEMENT_PENDING' &&
                  (iAgreed ? (
                    <p className={m.muted}>You confirmed the agreement on {formatDateTime(iAgreed)}. Waiting for the other party.</p>
                  ) : (
                    <ActionButton path={`/user/marketplace/deals/${d.id}`} body={{ action: 'AGREE' }} confirm="Confirm you agree to the accepted terms?" successMessage="Agreement confirmed.">
                      Confirm agreement
                    </ActionButton>
                  ))}
                {d.status === 'DUE_DILIGENCE' &&
                  (isBuyer ? (
                    <p className={m.muted}>Review traffic, finances, code and accounts with the seller. The seller starts the transfer when you are both ready.</p>
                  ) : (
                    <ApiForm path={`/user/marketplace/deals/${d.id}`} extra={{ action: 'START_TRANSFER' }} submitLabel="Start transfer" successMessage="Transfer started.">
                      <Field label="Transfer notes (optional)" htmlFor="tx-note" hint="What will be handed over and how. Never paste passwords here.">
                        <Textarea id="tx-note" name="note" maxLength={2000} rows={3} />
                      </Field>
                    </ApiForm>
                  ))}
                {d.status === 'TRANSFER_IN_PROGRESS' &&
                  (isBuyer ? (
                    <ActionButton path={`/user/marketplace/deals/${d.id}`} body={{ action: 'CONFIRM_RECEIPT' }} confirm="Confirm you received everything agreed? This completes the transaction." successMessage="Transaction completed.">
                      Confirm receipt
                    </ActionButton>
                  ) : (
                    <p className={m.muted}>Waiting for the buyer to confirm receipt.</p>
                  ))}
              </Panel>
            )}
            <Panel title="Notes">
              {d.notes.length === 0 ? (
                <p className={m.muted}>No notes yet.</p>
              ) : (
                <div className={m.thread}>
                  {d.notes.map((n, i) => (
                    <div key={i} className={`${m.bubble} ${(n.by === 'BUYER') === isBuyer ? m.bubbleMine : ''}`}>
                      <small>
                        {(n.by === 'BUYER') === isBuyer ? 'You' : n.by === 'BUYER' ? 'Buyer' : 'Seller'} · {formatDateTime(n.at)}
                      </small>
                      {n.text}
                    </div>
                  ))}
                </div>
              )}
              {active && (
                <div style={{ marginTop: 12 }}>
                  <ApiForm path={`/user/marketplace/deals/${d.id}`} extra={{ action: 'NOTE' }} submitLabel="Add note" submitVariant="outline" successMessage="Note added." resetOnSuccess>
                    <Field label="Note" htmlFor="deal-note">
                      <Textarea id="deal-note" name="note" required maxLength={2000} rows={2} />
                    </Field>
                  </ApiForm>
                </div>
              )}
            </Panel>
          </div>
          <div className={m.stack}>
            <Panel title="Summary">
              <KeyValue label="Agreed price" value={money(d.amountMinor, d.currency)} />
              <KeyValue label="Buyer agreed" value={formatDateTime(d.buyerAgreedAt)} />
              <KeyValue label="Seller agreed" value={formatDateTime(d.sellerAgreedAt)} />
              <KeyValue label="Transfer started" value={formatDateTime(d.transferStartedAt)} />
              <KeyValue label="Completed" value={formatDateTime(d.completedAt)} />
              <p className={m.muted} style={{ marginTop: 8 }}>
                Payment for acquisitions is arranged between buyer and seller; AmpliVerify does not hold these funds. Add the asset to your portfolio and verify ownership after the transfer.
              </p>
            </Panel>
            <Panel title="Issues">
              {d.cases && d.cases.length > 0 && (
                <ul className={m.list} style={{ marginBottom: 10 }}>
                  {d.cases.map((c) => (
                    <li key={c.id}>
                      {c.reason} · <Badge>{c.status.replace(/_/g, ' ').toLowerCase()}</Badge>
                    </li>
                  ))}
                </ul>
              )}
              <ApiForm path="/user/marketplace/cases" extra={{ transactionId: d.id, kind: 'ISSUE' }} submitLabel="Report an issue" submitVariant="outline" successMessage="Issue reported. Our team will review it." resetOnSuccess>
                <Field label="Subject" htmlFor="case-r">
                  <Input id="case-r" name="reason" required minLength={3} maxLength={200} />
                </Field>
                <Field label="What happened?" htmlFor="case-d" hint="At least 20 characters.">
                  <Textarea id="case-d" name="details" required minLength={20} maxLength={5000} rows={3} />
                </Field>
              </ApiForm>
              {active && (
                <div style={{ marginTop: 12 }}>
                  <NoteAction path={`/user/marketplace/deals/${d.id}`} body={{ action: 'CANCEL' }} label="Cancel transaction" placeholder="Reason for cancelling" confirm="Cancel this transaction?" successMessage="Transaction canceled." />
                </div>
              )}
            </Panel>
          </div>
        </div>
      </div>
    </>
  );
}
