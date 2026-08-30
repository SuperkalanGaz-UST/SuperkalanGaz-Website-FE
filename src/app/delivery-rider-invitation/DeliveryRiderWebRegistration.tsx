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
  Smartphone,
  UserRound,
} from 'lucide-react';
import {
  acceptDeliveryRiderInvitation,
  createDeliveryRiderAccount,
  getDeliveryRiderInvitation,
  sendDeliveryRiderMobileCode,
  verifyDeliveryRiderMobile,
  type DeliveryRiderInvitation,
} from '@/app/lib/deliveryRiderRegistration';
import styles from './page.module.css';

type RegistrationStep = 'details' | 'password' | 'mobile' | 'review' | 'success';

interface DeliveryRiderWebRegistrationProps {
  token: string | null;
  openAppUrl: string | null;
  androidDownloadUrl: string | null;
  iosDownloadUrl: string | null;
}

function displayMobile(value: string): string {
  const digits = value.replace(/\D/g, '').replace(/^63/, '');
  return digits.length === 10
    ? `+63 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
    : value;
}

function maskedMobile(value: string): string {
  const formatted = displayMobile(value);
  return formatted.length > 4 ? `${formatted.slice(0, -4)}••••` : formatted;
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
  const current = step === 'password' ? 1 : step === 'mobile' ? 2 : step === 'review' ? 3 : 0;
  if (current === 0) return null;

  return (
    <div className={styles.progress} aria-label={`Registration step ${current} of 3`}>
      {['Password', 'Mobile', 'Activate'].map((label, index) => {
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
  openAppUrl,
  androidDownloadUrl,
  iosDownloadUrl,
}: DeliveryRiderWebRegistrationProps) {
  const [invitation, setInvitation] = useState<DeliveryRiderInvitation | null>(null);
  const [step, setStep] = useState<RegistrationStep>('details');
  const [loading, setLoading] = useState(Boolean(token));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);

  const hasDownloadUrl = Boolean(androidDownloadUrl || iosDownloadUrl);
  const expiry = useMemo(() => invitation ? displayExpiry(invitation.expiresAt) : '', [invitation]);

  const loadInvitation = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const loaded = await getDeliveryRiderInvitation(token);
      setInvitation(loaded);
      setStep('details');
    } catch (loadError) {
      setInvitation(null);
      setError(loadError instanceof Error ? loadError.message : 'This invitation is unavailable.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadInvitation();
  }, [loadInvitation]);

  const continueFromDetails = () => {
    if (!invitation?.emailVerified) {
      setError('Open the verified email invitation before continuing.');
      return;
    }
    setError('');
    if (invitation.mobileVerified) setStep('review');
    else if (invitation.accountCreated) setStep('mobile');
    else setStep('password');
  };

  const sendMobileCode = async () => {
    if (!token) return;
    setBusy(true);
    setError('');
    try {
      await sendDeliveryRiderMobileCode(token);
      setCode('');
      setCodeSent(true);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Could not send the verification code.');
    } finally {
      setBusy(false);
    }
  };

  const createAccount = async () => {
    if (!token || !invitation) return;
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
      await createDeliveryRiderAccount(token, password);
      setInvitation({ ...invitation, accountCreated: true });
      setStep('mobile');
      try {
        await sendDeliveryRiderMobileCode(token);
        setCodeSent(true);
      } catch (sendError) {
        setError(sendError instanceof Error ? sendError.message : 'Your account was created, but the verification code could not be sent.');
      }
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Could not create the Delivery Rider account.');
    } finally {
      setBusy(false);
    }
  };

  const verifyMobile = async () => {
    if (!token || !invitation) return;
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the complete 6-digit verification code.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await verifyDeliveryRiderMobile(token, code);
      setInvitation({ ...invitation, mobileVerified: true });
      setStep('review');
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : 'Could not verify the PH mobile number.');
    } finally {
      setBusy(false);
    }
  };

  const acceptInvitation = async () => {
    if (!token) return;
    setBusy(true);
    setError('');
    try {
      await acceptDeliveryRiderInvitation(token);
      setStep('success');
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : 'Could not activate the Delivery Rider account.');
    } finally {
      setBusy(false);
    }
  };

  const backToDetails = () => {
    setError('');
    setStep('details');
  };

  const registrationContent = () => {
    if (!token) {
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
          {openAppUrl ? <a className={styles.textLink} href={openAppUrl}><Smartphone size={16} />Continue in the mobile app instead</a> : null}
        </>
      );
    }

    if (step === 'password') {
      return (
        <>
          <button className={styles.backButton} type="button" onClick={backToDetails}><ArrowLeft size={17} />Invitation details</button>
          <Progress step={step} />
          <p className={styles.eyebrow}>Step 1 of 3</p>
          <h1 id="invitation-title">Create your password</h1>
          <p className={styles.lead}>This password is private. The Branch Owner and Branch Manager cannot see or reset it.</p>
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

    if (step === 'mobile') {
      return (
        <>
          <button className={styles.backButton} type="button" onClick={backToDetails}><ArrowLeft size={17} />Invitation details</button>
          <Progress step={step} />
          <p className={styles.eyebrow}>Step 2 of 3</p>
          <h1 id="invitation-title">Verify your PH mobile number</h1>
          <p className={styles.lead}>{codeSent ? `Enter the 6-digit code sent to ${maskedMobile(invitation.mobile)}.` : `Send a verification code to ${maskedMobile(invitation.mobile)}.`}</p>
          <div className={styles.mobileCard}><span className={styles.mobilePrefix}>+63</span><span>{displayMobile(invitation.mobile).replace(/^\+63\s?/, '')}</span><LockKeyhole size={15} aria-label="Locked" /></div>
          {codeSent ? (
            <label className={styles.inputGroup}>
              <span>Verification code</span>
              <input className={styles.otpInput} autoComplete="one-time-code" inputMode="numeric" maxLength={6} onChange={(event) => { setCode(event.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }} placeholder="000000" value={code} />
            </label>
          ) : null}
          {error ? <div className={styles.errorBanner}>{error}</div> : null}
          {codeSent ? (
            <>
              <button className={styles.primaryButton} type="button" disabled={busy} onClick={() => void verifyMobile()}>{busy ? <Loader2 className={styles.spinner} size={18} /> : <ShieldCheck size={18} />}{busy ? 'Verifying…' : 'Verify number'}</button>
              <button className={styles.textButton} type="button" disabled={busy} onClick={() => void sendMobileCode()}>Resend verification code</button>
            </>
          ) : (
            <button className={styles.primaryButton} type="button" disabled={busy} onClick={() => void sendMobileCode()}>{busy ? <Loader2 className={styles.spinner} size={18} /> : <Phone size={18} />}{busy ? 'Sending code…' : 'Send verification code'}</button>
          )}
        </>
      );
    }

    if (step === 'review') {
      return (
        <>
          <button className={styles.backButton} type="button" onClick={backToDetails}><ArrowLeft size={17} />Invitation details</button>
          <Progress step={step} />
          <p className={styles.eyebrow}>Step 3 of 3</p>
          <h1 id="invitation-title">Accept your branch invitation</h1>
          <p className={styles.lead}>Both identity checks are complete. Accepting activates one Delivery Rider membership for the locked branch below.</p>
          <div className={styles.reviewCard}><div><span>Role</span><strong>Delivery Rider</strong></div><div><span>Authorized branch</span><strong>{invitation.branchName}</strong></div></div>
          <div className={styles.verifiedPill}><CheckCircle2 size={16} />Email and PH mobile verified</div>
          {error ? <div className={styles.errorBanner}>{error}</div> : null}
          <button className={styles.primaryButton} type="button" disabled={busy} onClick={() => void acceptInvitation()}>{busy ? <Loader2 className={styles.spinner} size={18} /> : <Check size={18} />}{busy ? 'Activating your account…' : 'Accept invitation'}</button>
          <p className={styles.finePrint}>No second Branch Manager approval is required.</p>
        </>
      );
    }

    return (
      <div className={styles.successPanel}>
        <div className={styles.successIcon}><Check size={34} aria-hidden="true" /></div>
        <p className={styles.eyebrow}>Registration complete</p>
        <h1 id="invitation-title">Your Delivery Rider account is ready</h1>
        <p className={styles.lead}>Sign in to the Superkalan Gaz mobile app with {invitation.email} and the password you created. Your account begins Offline and without a vehicle assignment.</p>
        <a className={styles.primaryButton} href="superkalan://"><Smartphone size={18} />Open Superkalan Gaz</a>
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
        <aside className={styles.sidePanel}>
          <div className={styles.brand}>
            <span className={styles.logoWrap}><Image src="/logo%20only.png" alt="" width={28} height={33} priority /></span>
            <span>Superkalan Gaz</span>
          </div>
          <div className={styles.sideCopy}>
            <span className={styles.sideIcon}><ShieldCheck size={26} /></span>
            <p className={styles.sideEyebrow}>Invitation-authorized onboarding</p>
            <h2>Register securely from your laptop or mobile device.</h2>
            <p>Your email, PH mobile number, role, and branch remain bound to the Branch Owner&apos;s invitation.</p>
          </div>
          <ul className={styles.assurances}>
            <li><CheckCircle2 size={17} />Single-use invitation</li>
            <li><CheckCircle2 size={17} />Locked branch authorization</li>
            <li><CheckCircle2 size={17} />Private password creation</li>
          </ul>
          <p className={styles.sideFooter}>Delivery operations remain available only in the mobile app.</p>
        </aside>
        <div className={styles.formPanel}>{registrationContent()}</div>
      </section>
    </main>
  );
}
