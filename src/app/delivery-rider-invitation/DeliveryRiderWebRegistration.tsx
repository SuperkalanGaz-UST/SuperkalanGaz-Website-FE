'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import {
  acceptDeliveryRiderInvitation,
  clearDeliveryRiderWebSession,
  createDeliveryRiderAccount,
  getDeliveryRiderInvitation,
  type DeliveryRiderInvitation,
  type DeliveryRiderRegistrationCredential,
} from '@/app/lib/deliveryRiderRegistration';
import styles from './page.module.css';

type RegistrationStep = 'details' | 'password' | 'review' | 'success';

interface DeliveryRiderWebRegistrationProps {
  token: string | null;
  sessionMode: boolean;
  androidDownloadUrl: string | null;
  iosDownloadUrl: string | null;
}

function displayMobile(value: string): string {
  const digits = value.replace(/\D/g, '').replace(/^63/, '');
  return digits.length === 10
    ? `+63 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
    : value;
}

function displayExpiry(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Time-limited invitation';
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  }).format(date);
}

function LockedField({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
}) {
  return (
    <div className={styles.lockedField}>
      <span className={styles.fieldIcon} aria-hidden="true"><Icon size={18} /></span>
      <span className={styles.fieldCopy}>
        <span className={styles.fieldLabel}>{label}</span>
        <span className={styles.fieldValue}>{value}</span>
      </span>
      <LockKeyhole className={styles.fieldLock} size={15} aria-label="Locked" />
    </div>
  );
}

function Progress({ step }: { step: RegistrationStep }) {
  const current = step === 'password' ? 1 : step === 'review' ? 2 : 0;
  if (current === 0) return null;

  return (
    <div className={styles.progress} aria-label={`Registration step ${current} of 2`}>
      {['Password', 'Accept'].map((label, index) => {
        const number = index + 1;
        const complete = number < current;
        const active = number === current;
        return (
          <div className={styles.progressItem} key={label}>
            <span className={`${styles.progressDot} ${active ? styles.progressDotActive : ''} ${complete ? styles.progressDotComplete : ''}`}>
              {complete ? <Check size={14} /> : number}
            </span>
            <span className={active ? styles.progressLabelActive : styles.progressLabel}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function DeliveryRiderWebRegistration({
  token,
  sessionMode,
  androidDownloadUrl,
  iosDownloadUrl,
}: DeliveryRiderWebRegistrationProps) {
  const [invitation, setInvitation] = useState<DeliveryRiderInvitation | null>(null);
  const [step, setStep] = useState<RegistrationStep>('details');
  const [loading, setLoading] = useState(Boolean(token || sessionMode));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const credential = useMemo<DeliveryRiderRegistrationCredential | null>(
    () => token ? { mode: 'token', token } : sessionMode ? { mode: 'session' } : null,
    [sessionMode, token],
  );
  const hasDownloadUrl = Boolean(androidDownloadUrl || iosDownloadUrl);
  const expiry = useMemo(() => invitation ? displayExpiry(invitation.expiresAt) : '', [invitation]);

  const loadInvitation = useCallback(async () => {
    if (!credential) return;
    setLoading(true);
    setError('');
    try {
      const loaded = await getDeliveryRiderInvitation(credential);
      setInvitation(loaded);
      setStep('details');
    } catch (loadError) {
      setInvitation(null);
      setError(loadError instanceof Error ? loadError.message : 'This invitation is unavailable.');
    } finally {
      setLoading(false);
    }
  }, [credential]);

  useEffect(() => {
    void loadInvitation();
  }, [loadInvitation]);

  const continueFromDetails = () => {
    if (!invitation?.emailVerified) {
      setError('Open the verified email invitation before continuing.');
      return;
    }
    setError('');
    setStep(invitation.accountCreated ? 'review' : 'password');
  };

  const createAccount = async () => {
    if (!credential || !invitation) return;
    if (password.length < 8) {
      setError('Use at least 8 characters for your password.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      await createDeliveryRiderAccount(credential, password);
      setInvitation({ ...invitation, accountCreated: true });
      setStep('review');
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Could not create the Delivery Rider account.');
    } finally {
      setBusy(false);
    }
  };

  const acceptInvitation = async () => {
    if (!credential) return;
    setBusy(true);
    setError('');
    try {
      await acceptDeliveryRiderInvitation(credential);
      await clearDeliveryRiderWebSession().catch(() => undefined);
      setStep('success');
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : 'Could not accept the Delivery Rider invitation.');
    } finally {
      setBusy(false);
    }
  };

  const backToDetails = () => {
    setError('');
    setStep('details');
  };

  const registrationContent = () => {
    if (!credential) {
      return (
        <div className={styles.statePanel}>
          <ShieldCheck size={34} aria-hidden="true" />
          <h1 id="invitation-title">This invitation link is incomplete</h1>
          <p>Open the complete link from your latest Superkalan Gaz invitation email.</p>
        </div>
      );
    }

    if (loading) {
      return (
        <div className={styles.statePanel} aria-live="polite">
          <Loader2 className={styles.spinner} size={34} aria-hidden="true" />
          <h1 id="invitation-title">Checking your secure invitation</h1>
          <p>Please keep this page open.</p>
        </div>
      );
    }

    if (!invitation) {
      return (
        <div className={styles.statePanel}>
          <ShieldCheck size={34} aria-hidden="true" />
          <h1 id="invitation-title">Invitation unavailable</h1>
          <p>{error || 'The invitation may be invalid, expired, revoked, or already used.'}</p>
          <button className={styles.primaryButton} type="button" onClick={() => void loadInvitation()}><RefreshCw size={18} />Try again</button>
        </div>
      );
    }

    if (step === 'details') {
      return (
        <>
          <p className={styles.eyebrow}>Secure invitation</p>
          <h1 id="invitation-title">Review your Delivery Rider invitation</h1>
          <p className={styles.lead}>Your identity and assigned branch were authorized by the Branch Owner and cannot be changed during registration.</p>
          <div className={styles.verifiedPill}><CheckCircle2 size={16} />Email invitation verified</div>
          <div className={styles.lockedGrid}>
            <LockedField icon={UserRound} label="Delivery Rider" value={invitation.recipientName} />
            <LockedField icon={Mail} label="Email address" value={invitation.email} />
            <LockedField icon={Phone} label="PH mobile number" value={displayMobile(invitation.mobile)} />
            <LockedField icon={MapPin} label="Authorized branch" value={invitation.branchName} />
          </div>
          <div className={styles.expiryNote}><Clock3 size={16} />Invitation expires {expiry}</div>
          {error ? <div className={styles.errorBanner}>{error}</div> : null}
          <button className={styles.primaryButton} type="button" onClick={continueFromDetails}>Continue registration<ArrowRight size={18} /></button>
        </>
      );
    }

    if (step === 'password') {
      return (
        <>
          <button className={styles.backButton} type="button" onClick={backToDetails}><ArrowLeft size={17} />Invitation details</button>
          <Progress step={step} />
          <p className={styles.eyebrow}>Step 1 of 2</p>
          <h1 id="invitation-title">Create your password</h1>
          <p className={styles.lead}>Choose a private password for your Delivery Rider account. You will verify your PH mobile number in the app after registration.</p>
          <div className={styles.formFields}>
            <label className={styles.inputGroup}>
              <span>Password</span>
              <span className={styles.passwordInput}>
                <input autoComplete="new-password" minLength={8} maxLength={72} onChange={(event) => { setPassword(event.target.value); setError(''); }} placeholder="At least 8 characters" type={showPassword ? 'text' : 'password'} value={password} />
                <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </span>
            </label>
            <label className={styles.inputGroup}>
              <span>Confirm password</span>
              <input autoComplete="new-password" minLength={8} maxLength={72} onChange={(event) => { setConfirmPassword(event.target.value); setError(''); }} placeholder="Enter password again" type={showPassword ? 'text' : 'password'} value={confirmPassword} />
            </label>
          </div>
          {error ? <div className={styles.errorBanner}>{error}</div> : null}
          <button className={styles.primaryButton} type="button" disabled={busy} onClick={() => void createAccount()}>{busy ? <Loader2 className={styles.spinner} size={18} /> : <LockKeyhole size={18} />}{busy ? 'Creating your account…' : 'Create account and continue'}</button>
        </>
      );
    }

    if (step === 'review') {
      return (
        <>
          <button className={styles.backButton} type="button" onClick={backToDetails}><ArrowLeft size={17} />Invitation details</button>
          <Progress step={step} />
          <p className={styles.eyebrow}>Step 2 of 2</p>
          <h1 id="invitation-title">Accept your branch invitation</h1>
          <p className={styles.lead}>Your email is verified and your password is set. Accept the invitation below, then verify your PH mobile number when you sign in to the app.</p>
          <div className={styles.reviewCard}><div><span>Role</span><strong>Delivery Rider</strong></div><div><span>Authorized branch</span><strong>{invitation.branchName}</strong></div></div>
          <div className={styles.verifiedPill}><CheckCircle2 size={16} />Email verified and password created</div>
          {error ? <div className={styles.errorBanner}>{error}</div> : null}
          <button className={styles.primaryButton} type="button" disabled={busy} onClick={() => void acceptInvitation()}>{busy ? <Loader2 className={styles.spinner} size={18} /> : <Check size={18} />}{busy ? 'Accepting invitation…' : 'Accept invitation'}</button>
        </>
      );
    }

    return (
      <div className={styles.successPanel}>
        <div className={styles.successIcon}><Check size={34} aria-hidden="true" /></div>
        <p className={styles.eyebrow}>Account created</p>
        <h1 id="invitation-title">Continue in the mobile app</h1>
        <p className={styles.lead}>Sign in with {invitation.email} and the password you created. The app will ask you to verify your PH mobile number before opening the Delivery Rider workspace.</p>
        <a className={styles.primaryButton} href="superkalan://"><Phone size={18} />Open Superkalan Gaz</a>
        {hasDownloadUrl ? (
          <div className={styles.storeButtons}>
            {androidDownloadUrl ? <a href={androidDownloadUrl} rel="noreferrer"><Download size={17} />Download for Android</a> : null}
            {iosDownloadUrl ? <a href={iosDownloadUrl} rel="noreferrer"><Download size={17} />Download for iPhone</a> : null}
          </div>
        ) : <p className={styles.installNote}>Ask your Branch Owner for the approved Superkalan Gaz app installation source.</p>}
      </div>
    );
  };

  return (
    <main className={styles.page}>
      <div className={styles.backdrop} aria-hidden="true" />
      <section className={styles.shell} aria-labelledby="invitation-title">
        <div className={styles.brandPanel}>
          <Image src="/superkalan-gaz.png" alt="Superkalan Gaz" width={380} height={260} priority />
        </div>
        <div className={styles.formPanel}>{registrationContent()}</div>
      </section>
    </main>
  );
}
