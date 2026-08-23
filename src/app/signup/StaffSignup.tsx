'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  ClipboardCheck,
  Eye,
  EyeOff,
  FileCheck2,
  FileText,
  FolderLock,
  IdCard,
  KeyRound,
  LockKeyhole,
  PencilLine,
  ShieldCheck,
  Store,
  Upload,
  UserRound,
  X,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { citiesMunicipalitiesForProvince } from '../lib/phCitiesMunicipalities';
import { formatPhMobileNational, toE164PhMobile } from '../lib/phMobile';
import { PH_PROVINCES } from '../lib/phProvinces';
import styles from './signup.module.css';

type SignupRole = 'franchise-admin' | 'branch-owner' | 'branch-manager';
type StepId = 'profile' | 'branch' | 'assignment' | 'documents' | 'review';
type DocumentKey =
  | 'governmentId'
  | 'authorizationLetter'
  | 'proofOfAddress'
  | 'businessRegistration'
  | 'businessPermit'
  | 'branchAuthorization';

interface RoleOption {
  id: SignupRole;
  label: string;
  description: string;
  icon: typeof ShieldCheck;
}

interface SignupStep {
  id: StepId;
  label: string;
}

interface ProfileDraft {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

interface BranchDraft {
  name: string;
  contactNumber: string;
  address: string;
  city: string;
  province: string;
}

interface DocumentRequirement {
  key: DocumentKey;
  title: string;
  helper: string;
  detail: string;
  accept: string;
  group: 'Identity' | 'Business records' | 'Authorization';
  kind: 'pdf' | 'image-or-pdf';
}

type FieldErrors = Partial<Record<string, string>>;
type SignupFiles = Partial<Record<DocumentKey, File>>;
type FileErrors = Partial<Record<DocumentKey, string>>;

const MAX_FILE_BYTES = 5 * 1024 * 1024;

const ROLE_OPTIONS: RoleOption[] = [
  {
    id: 'branch-owner',
    label: 'Branch Owner',
    description: 'Register and configure your approved branch.',
    icon: KeyRound,
  },
  {
    id: 'branch-manager',
    label: 'Branch Manager',
    description: 'Handle day-to-day operations for an assigned branch.',
    icon: ClipboardCheck,
  },
];

const STEPS_BY_ROLE: Record<SignupRole, SignupStep[]> = {
  'franchise-admin': [
    { id: 'profile', label: 'Profile' },
    { id: 'documents', label: 'Documents' },
    { id: 'review', label: 'Review' },
  ],
  'branch-owner': [
    { id: 'profile', label: 'Profile' },
    { id: 'branch', label: 'Branch' },
    { id: 'documents', label: 'Documents' },
    { id: 'review', label: 'Review' },
  ],
  'branch-manager': [
    { id: 'profile', label: 'Profile' },
    { id: 'assignment', label: 'Assignment' },
    { id: 'documents', label: 'Documents' },
    { id: 'review', label: 'Review' },
  ],
};

const GOVERNMENT_ID: DocumentRequirement = {
  key: 'governmentId',
  title: 'Government-issued ID',
  helper: 'PDF, JPG or PNG • Max 5 MB',
  detail: 'Upload one clear copy',
  accept: '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png',
  group: 'Identity',
  kind: 'image-or-pdf',
};

const DOCUMENTS_BY_ROLE: Record<SignupRole, DocumentRequirement[]> = {
  'franchise-admin': [
    GOVERNMENT_ID,
    {
      key: 'authorizationLetter',
      title: 'Authorization letter',
      helper: 'PDF only • Max 5 MB',
      detail: 'Signed authorization from Superkalan Gaz',
      accept: '.pdf,application/pdf',
      group: 'Authorization',
      kind: 'pdf',
    },
  ],
  'branch-owner': [
    GOVERNMENT_ID,
    {
      key: 'proofOfAddress',
      title: 'Proof of address',
      helper: 'PDF, JPG or PNG • Max 5 MB',
      detail: 'Use a clear and current copy',
      accept: '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png',
      group: 'Identity',
      kind: 'image-or-pdf',
    },
    {
      key: 'businessRegistration',
      title: 'DTI or SEC registration certificate',
      helper: 'PDF only • Max 5 MB',
      detail: 'Upload the complete certificate',
      accept: '.pdf,application/pdf',
      group: 'Business records',
      kind: 'pdf',
    },
    {
      key: 'businessPermit',
      title: 'Local business permit',
      helper: 'PDF only • Max 5 MB',
      detail: 'Upload the complete permit',
      accept: '.pdf,application/pdf',
      group: 'Business records',
      kind: 'pdf',
    },
  ],
  'branch-manager': [
    GOVERNMENT_ID,
    {
      key: 'branchAuthorization',
      title: 'Branch authorization letter',
      helper: 'PDF only • Max 5 MB',
      detail: 'Authorization for the assigned Branch Manager account',
      accept: '.pdf,application/pdf',
      group: 'Authorization',
      kind: 'pdf',
    },
  ],
};

const EMPTY_PROFILE: ProfileDraft = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
};

const EMPTY_BRANCH: BranchDraft = {
  name: '',
  contactNumber: '',
  address: '',
  city: '',
  province: '',
};

function roleLabel(role: SignupRole): string {
  return ROLE_OPTIONS.find((option) => option.id === role)?.label ?? '';
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function fileExtension(name: string): string {
  return name.toLowerCase().split('.').pop() ?? '';
}

function bytesMatch(bytes: Uint8Array, expected: readonly number[], offset = 0): boolean {
  return expected.every((value, index) => bytes[offset + index] === value);
}

async function validateUpload(file: File, requirement: DocumentRequirement): Promise<string | null> {
  if (file.size === 0) return 'This file is empty.';
  if (file.size > MAX_FILE_BYTES) return 'File exceeds the 5 MB limit.';

  const extension = fileExtension(file.name);
  const allowedPdf = extension === 'pdf' && file.type === 'application/pdf';
  const allowedJpeg = ['jpg', 'jpeg'].includes(extension) && file.type === 'image/jpeg';
  const allowedPng = extension === 'png' && file.type === 'image/png';

  if (requirement.kind === 'pdf' && !allowedPdf) return 'Choose a PDF file only.';
  if (requirement.kind === 'image-or-pdf' && !allowedPdf && !allowedJpeg && !allowedPng) {
    return 'Choose a PDF, JPG, or PNG file.';
  }

  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  if (allowedPdf) {
    if (!bytesMatch(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
      return 'The file content does not match a valid PDF.';
    }
    const pdfText = new TextDecoder('latin1').decode(bytes);
    if (!pdfText.includes('%%EOF')) return 'The PDF appears incomplete or damaged.';
    if (pdfText.includes('/Encrypt')) return 'Password-protected PDFs are not accepted.';
  }

  if (allowedJpeg) {
    const validStart = bytesMatch(bytes, [0xff, 0xd8, 0xff]);
    const validEnd = bytes.length >= 2 && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
    if (!validStart || !validEnd) return 'The JPG appears incomplete or damaged.';
  }

  if (allowedPng) {
    const validStart = bytesMatch(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const validEnd = bytes.length >= 12 && bytesMatch(bytes, [0x49, 0x45, 0x4e, 0x44], bytes.length - 8);
    if (!validStart || !validEnd) return 'The PNG appears incomplete or damaged.';
  }

  return null;
}

function SignupWaves() {
  return (
    <svg viewBox="0 0 1440 220" preserveAspectRatio="none" aria-hidden="true">
      <path fill="#d9eefb" d="M0 92C174 165 310 106 478 133c170 28 282 91 474 29 181-58 310-41 488 20v38H0Z" />
      <path fill="#afd9f4" d="M0 140c185-53 335 38 506 34 185-5 303-92 494-65 169 24 282 91 440 62v49H0Z" />
      <path fill="#7fc3ea" d="M0 177c199 34 340 10 488-27 181-45 329-4 488 29 173 36 314 15 464-8v49H0Z" />
    </svg>
  );
}

function SignupHeader() {
  return (
    <header className={styles.header}>
      <Link href="/" aria-label="Superkalan Gaz login">
        <Image src="/superkalan-gaz.png" alt="Superkalan Gaz" width={178} height={76} priority />
      </Link>
      <p>
        Already registered? <Link href="/">Sign in</Link>
      </p>
    </header>
  );
}

interface RoleSelectionProps {
  selectedRole: SignupRole | null;
  onSelect: (role: SignupRole) => void;
  onContinue: () => void;
}

function RoleSelection({ selectedRole, onSelect, onContinue }: RoleSelectionProps) {
  const [showInvitationHelp, setShowInvitationHelp] = useState(false);

  return (
    <main className={styles.roleMain}>
      <div className={styles.roleHeading}>
        <span>Staff registration</span>
        <h1>How are you joining Superkalan Gaz?</h1>
        <p>Choose the branch role named in your invitation. Franchise Administrator accounts use a secure, role-locked activation link.</p>
      </div>

      <div className={styles.roleGrid} role="radiogroup" aria-label="Registration role">
        {ROLE_OPTIONS.map((option) => {
          const Icon = option.icon;
          const selected = selectedRole === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`${styles.roleCard} ${selected ? styles.roleCardSelected : ''}`}
              onClick={() => onSelect(option.id)}
            >
              <span className={styles.roleSelector} aria-hidden="true">
                {selected && <Check />}
              </span>
              <span className={styles.roleIcon}><Icon /></span>
              <strong>{option.label}</strong>
              <span className={styles.roleDescription}>{option.description}</span>
            </button>
          );
        })}
      </div>

      <div className={styles.securityNotice}>
        <ShieldCheck aria-hidden="true" />
        <span>Choosing a branch role does not grant permissions. Access follows the verified invitation and required review workflow.</span>
      </div>

      <div className={styles.roleActions}>
        <button
          type="button"
          className={styles.helpLink}
          aria-haspopup="dialog"
          onClick={() => setShowInvitationHelp(true)}
        >
          <CircleHelp aria-hidden="true" /> I need help with my invitation
        </button>
        <div>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={!selectedRole}
            onClick={onContinue}
          >
            {selectedRole ? `Continue as ${roleLabel(selectedRole)}` : 'Select a role to continue'}
            <ArrowRight aria-hidden="true" />
          </button>
          <small>You can change your selection before submitting.</small>
        </div>
      </div>

      {showInvitationHelp && (
        <div
          className={styles.invitationHelpBackdrop}
          role="presentation"
          onClick={() => setShowInvitationHelp(false)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setShowInvitationHelp(false);
          }}
        >
          <div
            className={styles.invitationHelp}
            role="dialog"
            aria-modal="true"
            aria-labelledby="invitation-help-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.invitationHelpHeader}>
              <span className={styles.invitationHelpIcon} aria-hidden="true"><CircleHelp /></span>
              <h2 id="invitation-help-title">Invitation help</h2>
              <button
                type="button"
                className={styles.invitationHelpClose}
                aria-label="Close invitation help"
                autoFocus
                onClick={() => setShowInvitationHelp(false)}
              >
                <X aria-hidden="true" />
              </button>
            </div>
            <p>For Branch Owner or Branch Manager registration, contact the Franchise Administrator who initiated your registration. Franchise Administrator invitees should use the role-locked activation link sent by the Super Administrator.</p>
          </div>
        </div>
      )}
    </main>
  );
}

interface ProgressProps {
  steps: SignupStep[];
  currentIndex: number;
  onNavigate: (index: number) => void;
}

function SignupProgress({ steps, currentIndex, onNavigate }: ProgressProps) {
  return (
    <ol className={styles.progress} aria-label="Registration progress">
      {steps.map((step, index) => {
        const completed = index < currentIndex;
        const active = index === currentIndex;
        return (
          <li key={step.id} className={active ? styles.progressActive : completed ? styles.progressComplete : ''}>
            <button type="button" disabled={index > currentIndex} onClick={() => onNavigate(index)}>
              <span>{completed ? <Check aria-hidden="true" /> : index + 1}</span>
              {step.label}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function StepGuide({ role, step }: { role: SignupRole; step: StepId }) {
  if (step === 'profile') {
    return (
      <aside className={styles.guide}>
        <span className={styles.guideArt}><IdCard /><ClipboardCheck /></span>
        <h2>{role === 'franchise-admin' ? 'A few details to set up your account' : `Set up your ${roleLabel(role)} account`}</h2>
        <p>Complete the details linked to your invitation.</p>
        <span className={styles.guideMeta}>About {role === 'franchise-admin' ? '3' : '4'} minutes</span>
      </aside>
    );
  }

  if (step === 'branch') {
    return (
      <aside className={styles.guide}>
        <span className={styles.guideArt}><Store /><PencilLine /></span>
        <h2>Tell us about your branch</h2>
        <p>Enter the information the Franchise Administrator will review.</p>
        <ol className={styles.guideTimeline}>
          <li className={styles.timelineActive}>You enter branch details</li>
          <li>Franchise Administrator approves</li>
          <li>Geolocation is assigned</li>
        </ol>
      </aside>
    );
  }

  if (step === 'assignment') {
    return (
      <aside className={styles.guide}>
        <span className={styles.guideArt}><Store /><LockKeyhole /></span>
        <h2>Confirm where you’ll work</h2>
        <p>Your invitation defines your role and assigned branch.</p>
        <span className={styles.guideMeta}>Access is limited to one branch</span>
      </aside>
    );
  }

  if (step === 'documents') {
    return (
      <aside className={styles.guide}>
        <span className={styles.guideArt}><FolderLock /><FileCheck2 /></span>
        <h2>Documents for verification</h2>
        <p>Prepare clear copies before you continue.</p>
        <ul className={styles.guideChecklist}>
          <li><CheckCircle2 /> Exact file types only</li>
          <li><CheckCircle2 /> Maximum 5 MB each</li>
          <li><CheckCircle2 /> No password-protected PDFs</li>
        </ul>
      </aside>
    );
  }

  const reviewActor = role === 'franchise-admin' ? 'Invitation validation' : 'Franchise Administrator approval';
  return (
    <aside className={styles.guide}>
      <span className={styles.guideArt}><ClipboardCheck /><BadgeCheck /></span>
      <h2>Review before sending</h2>
      <p>You can return to any step without re-entering information.</p>
      <ol className={styles.guideTimeline}>
        <li className={styles.timelineActive}>Submit registration</li>
        <li>{reviewActor}</li>
        <li>Account activation</li>
      </ol>
    </aside>
  );
}

interface ProfileStepProps {
  role: SignupRole;
  draft: ProfileDraft;
  errors: FieldErrors;
  showPassword: boolean;
  showConfirmPassword: boolean;
  onChange: (patch: Partial<ProfileDraft>) => void;
  onTogglePassword: () => void;
  onToggleConfirmPassword: () => void;
}

function ProfileStep({
  role,
  draft,
  errors,
  showPassword,
  showConfirmPassword,
  onChange,
  onTogglePassword,
  onToggleConfirmPassword,
}: ProfileStepProps) {
  return (
    <>
      <StepHeading
        eyebrow={`Step 1 of ${STEPS_BY_ROLE[role].length}`}
        title={role === 'franchise-admin' ? 'Tell us about yourself' : 'Start with your details'}
        description={`Use the information requested in your ${roleLabel(role)} invitation.`}
      />
      <div className={styles.formGrid}>
        <Field label="First name" error={errors.firstName}>
          <input value={draft.firstName} onChange={(event) => onChange({ firstName: event.target.value })} autoComplete="given-name" />
        </Field>
        <Field label="Last name" error={errors.lastName}>
          <input value={draft.lastName} onChange={(event) => onChange({ lastName: event.target.value })} autoComplete="family-name" />
        </Field>
        <Field label="Email address" error={errors.email} hint="Use the email where you received your invitation" wide>
          <input type="email" value={draft.email} onChange={(event) => onChange({ email: event.target.value })} autoComplete="email" />
        </Field>
        <Field label="Mobile number" error={errors.phone} hint="Enter a valid PH mobile number" wide>
          <div className={styles.phoneInput}>
            <span>+63</span>
            <input
              type="tel"
              inputMode="numeric"
              placeholder="9XX XXX XXXX"
              value={draft.phone}
              onChange={(event) => onChange({ phone: formatPhMobileNational(event.target.value) })}
              autoComplete="tel-national"
            />
          </div>
        </Field>
        <Field label="Password" error={errors.password}>
          <PasswordInput value={draft.password} visible={showPassword} onChange={(password) => onChange({ password })} onToggle={onTogglePassword} />
        </Field>
        <Field label="Confirm password" error={errors.confirmPassword}>
          <PasswordInput value={draft.confirmPassword} visible={showConfirmPassword} onChange={(confirmPassword) => onChange({ confirmPassword })} onToggle={onToggleConfirmPassword} />
        </Field>
      </div>
      <div className={styles.passwordRules}>
        <span className={draft.password.length >= 8 ? styles.ruleMet : ''}><CheckCircle2 /> At least 8 characters</span>
        <span className={/\d/.test(draft.password) ? styles.ruleMet : ''}><CheckCircle2 /> One number</span>
      </div>
    </>
  );
}

function PasswordInput({ value, visible, onChange, onToggle }: { value: string; visible: boolean; onChange: (value: string) => void; onToggle: () => void }) {
  return (
    <div className={styles.passwordInput}>
      <input type={visible ? 'text' : 'password'} value={value} onChange={(event) => onChange(event.target.value)} autoComplete="new-password" />
      <button type="button" onClick={onToggle} aria-label={visible ? 'Hide password' : 'Show password'}>
        {visible ? <EyeOff /> : <Eye />}
      </button>
    </div>
  );
}

function Field({ label, error, hint, wide = false, children }: { label: string; error?: string; hint?: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={`${styles.field} ${wide ? styles.fieldWide : ''}`}>
      <span>{label}</span>
      {children}
      {error ? <small className={styles.fieldError}>{error}</small> : hint ? <small>{hint}</small> : null}
    </label>
  );
}

function StepHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className={styles.stepHeading}>
      <span>{eyebrow}</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}

function BranchStep({ draft, errors, onChange }: { draft: BranchDraft; errors: FieldErrors; onChange: (patch: Partial<BranchDraft>) => void }) {
  const cityOptions = useMemo(() => citiesMunicipalitiesForProvince(draft.province), [draft.province]);

  return (
    <>
      <StepHeading eyebrow="Step 2 of 4" title="Enter branch details" description="Provide the registered contact and address for this branch." />
      <section className={styles.formSection}>
        <h2>Branch identity</h2>
        <div className={styles.formGrid}>
          <Field label="Branch name" error={errors.branchName} wide>
            <input value={draft.name} onChange={(event) => onChange({ name: event.target.value })} placeholder="Enter registered branch name" />
          </Field>
          <Field label="Contact number" error={errors.branchContact} hint="Enter a valid PH mobile number" wide>
            <div className={styles.phoneInput}>
              <span>+63</span>
              <input type="tel" inputMode="numeric" placeholder="9XX XXX XXXX" value={draft.contactNumber} onChange={(event) => onChange({ contactNumber: formatPhMobileNational(event.target.value) })} />
            </div>
          </Field>
        </div>
      </section>
      <section className={styles.formSection}>
        <h2>Registered address</h2>
        <div className={styles.formGrid}>
          <Field label="Full address" error={errors.address} wide>
            <input value={draft.address} onChange={(event) => onChange({ address: event.target.value })} placeholder="Street, building, or landmark" />
          </Field>
          <Field label="Province" error={errors.province}>
            <div className={styles.selectWrap}>
              <select
                value={draft.province}
                onChange={(event) => onChange({ province: event.target.value, city: '' })}
              >
                <option value="">Select province…</option>
                {PH_PROVINCES.map((province) => <option key={province.name} value={province.name}>{province.name}</option>)}
              </select>
              <ChevronDown aria-hidden="true" />
            </div>
          </Field>
          <Field label="City / Municipality" error={errors.city}>
            <div className={styles.selectWrap}>
              <select value={draft.city} disabled={!draft.province} onChange={(event) => onChange({ city: event.target.value })}>
                <option value="">{draft.province ? 'Select city or municipality…' : 'Select province first'}</option>
                {cityOptions.map((city) => <option key={city} value={city}>{city}</option>)}
              </select>
              <ChevronDown aria-hidden="true" />
            </div>
          </Field>
        </div>
      </section>
      <div className={styles.infoNotice}>
        <ShieldCheck /> The Franchise Administrator will review these details and assign the branch geolocation after approval.
      </div>
    </>
  );
}

function AssignmentStep({ confirmed, error, onChange }: { confirmed: boolean; error?: string; onChange: (confirmed: boolean) => void }) {
  return (
    <>
      <StepHeading eyebrow="Step 2 of 4" title="Confirm your assignment" description="Review the account access prepared by the Franchise Administrator." />
      <section className={styles.assignmentCard}>
        <span className={styles.pendingBadge}><AlertCircle /> Invitation verification required</span>
        <ReviewRow label="Assigned role" value="Branch Manager" locked />
        <ReviewRow label="Branch name" value="Provided after invitation verification" locked />
        <ReviewRow label="Branch location" value="Provided after invitation verification" locked />
        <ReviewRow label="Account scope" value="Assigned branch only" locked />
      </section>
      <label className={styles.checkboxRow}>
        <input type="checkbox" checked={confirmed} onChange={(event) => onChange(event.target.checked)} />
        <span>I recognize this Branch Manager assignment.</span>
      </label>
      {error && <p className={styles.checkboxError}>{error}</p>}
      <div className={styles.infoNotice}>
        <ShieldCheck /> Branch Manager access is limited to the branch in the verified invitation. Branch ownership settings remain separate.
      </div>
    </>
  );
}

interface DocumentsStepProps {
  role: SignupRole;
  files: SignupFiles;
  errors: FileErrors;
  onFile: (requirement: DocumentRequirement, file: File | null) => Promise<void>;
}

function DocumentsStep({ role, files, errors, onFile }: DocumentsStepProps) {
  const requirements = DOCUMENTS_BY_ROLE[role];
  const groups = Array.from(new Set(requirements.map((requirement) => requirement.group)));
  return (
    <>
      <StepHeading
        eyebrow={`Step ${STEPS_BY_ROLE[role].findIndex((step) => step.id === 'documents') + 1} of ${STEPS_BY_ROLE[role].length}`}
        title={role === 'branch-manager' ? 'Add verification documents' : 'Upload your documents'}
        description="Add only the files listed below. Each file is checked before it can be attached."
      />
      <div className={styles.documentGroups}>
        {groups.map((group) => (
          <section key={group}>
            {groups.length > 1 && <h2>{group}</h2>}
            <div className={requirements.length > 2 ? styles.uploadGrid : styles.uploadStack}>
              {requirements.filter((requirement) => requirement.group === group).map((requirement) => (
                <UploadCard
                  key={requirement.key}
                  requirement={requirement}
                  file={files[requirement.key]}
                  error={errors[requirement.key]}
                  onFile={(file) => onFile(requirement, file)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
      <div className={styles.infoNotice}>
        <ShieldCheck /> Files are checked before upload. Damaged, password-protected, or mismatched files are rejected.
      </div>
      <p className={styles.privacyHint}><LockKeyhole /> Files remain in this browser and are not submitted until the final step.</p>
    </>
  );
}

function UploadCard({ requirement, file, error, onFile }: { requirement: DocumentRequirement; file?: File; error?: string; onFile: (file: File | null) => Promise<void> }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const choose = async (list: FileList | null) => {
    await onFile(list?.item(0) ?? null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <article className={`${styles.uploadCard} ${error ? styles.uploadCardError : ''}`}>
      <div className={styles.uploadInfo}>
        <span className={styles.fileIcon}><FileText /></span>
        <div>
          <h3>{requirement.title}</h3>
          <strong>{requirement.helper}</strong>
          <p>{requirement.detail}</p>
        </div>
      </div>
      <div
        className={`${styles.dropZone} ${dragging ? styles.dropZoneActive : ''}`}
        onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void choose(event.dataTransfer.files);
        }}
      >
        {file ? (
          <>
            <FileCheck2 aria-hidden="true" />
            <span className={styles.fileName}>{file.name}</span>
            <button type="button" onClick={() => void onFile(null)}>Remove</button>
          </>
        ) : (
          <>
            <Upload aria-hidden="true" />
            <span>Drag and drop or</span>
            <button type="button" onClick={() => inputRef.current?.click()}>Choose file</button>
          </>
        )}
        <input ref={inputRef} type="file" accept={requirement.accept} onChange={(event) => void choose(event.target.files)} />
      </div>
      {error && <p className={styles.uploadError}>{error}</p>}
    </article>
  );
}

function ReviewRow({ label, value, locked = false }: { label: string; value: string; locked?: boolean }) {
  return (
    <div className={styles.reviewRow}>
      <span>{label}</span>
      <strong>{locked && <LockKeyhole aria-hidden="true" />}{value}</strong>
    </div>
  );
}

function ReviewStep({
  role,
  profile,
  branch,
  files,
  consent,
  consentError,
  submitError,
  onConsent,
  onEdit,
}: {
  role: SignupRole;
  profile: ProfileDraft;
  branch: BranchDraft;
  files: SignupFiles;
  consent: boolean;
  consentError?: string;
  submitError: string;
  onConsent: (value: boolean) => void;
  onEdit: (step: StepId) => void;
}) {
  const documents = DOCUMENTS_BY_ROLE[role];
  const approvalCopy = role === 'franchise-admin'
    ? 'Submitting activates your verified Franchise Administrator invitation. The role is fixed by the invitation and no second Super Administrator approval is required.'
    : role === 'branch-owner'
      ? 'Submitting sends the branch registration to the Franchise Administrator for approval and geolocation assignment. The decision and approver are recorded for Super Administrator audit visibility.'
      : 'Submitting sends the registration to the Franchise Administrator for approval. The decision and approver are recorded for Super Administrator audit visibility.';

  return (
    <>
      <StepHeading
        eyebrow={`Step ${STEPS_BY_ROLE[role].length} of ${STEPS_BY_ROLE[role].length}`}
        title={role === 'franchise-admin' ? 'Review your account activation' : 'Review your registration'}
        description="Confirm your details and documents before submitting."
      />
      <div className={styles.reviewSections}>
        <ReviewCard title="Profile" icon={UserRound} onEdit={() => onEdit('profile')}>
          <ReviewRow label="Name" value={`${profile.firstName} ${profile.lastName}`.trim() || 'Not provided'} />
          <ReviewRow label="Email address" value={profile.email || 'Not provided'} />
          <ReviewRow label="Mobile number" value={toE164PhMobile(profile.phone) ?? 'Not provided'} />
        </ReviewCard>

        {role === 'branch-owner' && (
          <ReviewCard title="Branch" icon={Store} onEdit={() => onEdit('branch')}>
            <ReviewRow label="Branch name" value={branch.name || 'Not provided'} />
            <ReviewRow label="Address" value={[branch.address, branch.city, branch.province].filter(Boolean).join(', ') || 'Not provided'} />
            <ReviewRow label="Status" value="Pending Franchise Administrator review" />
          </ReviewCard>
        )}

        {role === 'branch-manager' && (
          <ReviewCard title="Assignment" icon={BriefcaseBusiness} onEdit={() => onEdit('assignment')}>
            <ReviewRow label="Role" value="Branch Manager" />
            <ReviewRow label="Branch" value="Provided after invitation verification" />
            <ReviewRow label="Scope" value="Assigned branch only" />
          </ReviewCard>
        )}

        <ReviewCard title="Documents" icon={FileText} onEdit={() => onEdit('documents')}>
          {documents.map((document) => (
            <ReviewRow key={document.key} label={document.title} value={files[document.key] ? 'Ready — file checked' : 'Missing'} />
          ))}
        </ReviewCard>
      </div>
      <div className={styles.infoNotice}><ShieldCheck /> {approvalCopy}</div>
      <label className={styles.checkboxRow}>
        <input type="checkbox" checked={consent} onChange={(event) => onConsent(event.target.checked)} />
        <span>I confirm that the information and documents provided are true and accurate.</span>
      </label>
      {consentError && <p className={styles.checkboxError}>{consentError}</p>}
      {submitError && <div className={styles.submitError} role="alert"><AlertCircle /> {submitError}</div>}
    </>
  );
}

function ReviewCard({ title, icon: Icon, onEdit, children }: { title: string; icon: typeof UserRound; onEdit: () => void; children: React.ReactNode }) {
  return (
    <section className={styles.reviewCard}>
      <header>
        <h2><Icon /> {title}</h2>
        <button type="button" onClick={onEdit}>Edit <PencilLine /></button>
      </header>
      {children}
    </section>
  );
}

export function StaffSignup() {
  const [selectedRole, setSelectedRole] = useState<SignupRole | null>(null);
  const [role, setRole] = useState<SignupRole | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [profile, setProfile] = useState<ProfileDraft>(EMPTY_PROFILE);
  const [branch, setBranch] = useState<BranchDraft>(EMPTY_BRANCH);
  const [assignmentConfirmed, setAssignmentConfirmed] = useState(false);
  const [files, setFiles] = useState<SignupFiles>({});
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [fileErrors, setFileErrors] = useState<FileErrors>({});
  const [consent, setConsent] = useState(false);
  const [consentError, setConsentError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const steps = role ? STEPS_BY_ROLE[role] : [];
  const currentStep = steps[stepIndex]?.id;

  const beginSignup = () => {
    if (!selectedRole) return;
    setRole(selectedRole);
    setStepIndex(0);
    setSubmitError('');
  };

  const validateProfile = (): boolean => {
    const errors: FieldErrors = {};
    if (!profile.firstName.trim()) errors.firstName = 'Enter your first name.';
    if (!profile.lastName.trim()) errors.lastName = 'Enter your last name.';
    if (!isEmail(profile.email)) errors.email = 'Enter a valid email address.';
    if (!toE164PhMobile(profile.phone)) errors.phone = 'Enter a valid PH mobile number.';
    if (profile.password.length < 8 || !/\d/.test(profile.password)) errors.password = 'Use at least 8 characters and one number.';
    if (profile.confirmPassword !== profile.password) errors.confirmPassword = 'Passwords do not match.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateBranch = (): boolean => {
    const errors: FieldErrors = {};
    if (!branch.name.trim()) errors.branchName = 'Enter the registered branch name.';
    if (!toE164PhMobile(branch.contactNumber)) errors.branchContact = 'Enter a valid PH mobile number.';
    if (!branch.address.trim()) errors.address = 'Enter the registered branch address.';
    if (!branch.province) errors.province = 'Select a province.';
    if (!branch.city) errors.city = 'Select a city or municipality.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateDocuments = (): boolean => {
    if (!role) return false;
    const errors: FileErrors = {};
    for (const requirement of DOCUMENTS_BY_ROLE[role]) {
      if (!files[requirement.key]) errors[requirement.key] = 'This document is required.';
    }
    setFileErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateCurrentStep = (): boolean => {
    if (currentStep === 'profile') return validateProfile();
    if (currentStep === 'branch') return validateBranch();
    if (currentStep === 'assignment') {
      setFieldErrors(assignmentConfirmed ? {} : { assignment: 'Confirm the Branch Manager assignment to continue.' });
      return assignmentConfirmed;
    }
    if (currentStep === 'documents') return validateDocuments();
    return true;
  };

  const next = () => {
    setSubmitError('');
    if (!validateCurrentStep()) return;
    setStepIndex((current) => Math.min(current + 1, steps.length - 1));
  };

  const back = () => {
    setSubmitError('');
    if (stepIndex === 0) {
      setRole(null);
      return;
    }
    setStepIndex((current) => current - 1);
  };

  const editStep = (step: StepId) => {
    const index = steps.findIndex((candidate) => candidate.id === step);
    if (index >= 0) setStepIndex(index);
  };

  const setFile = async (requirement: DocumentRequirement, file: File | null) => {
    setFileErrors((current) => ({ ...current, [requirement.key]: undefined }));
    if (!file) {
      setFiles((current) => {
        const nextFiles = { ...current };
        delete nextFiles[requirement.key];
        return nextFiles;
      });
      return;
    }
    const error = await validateUpload(file, requirement);
    if (error) {
      setFileErrors((current) => ({ ...current, [requirement.key]: error }));
      return;
    }
    setFiles((current) => ({ ...current, [requirement.key]: file }));
  };

  const submit = () => {
    if (!consent) {
      setConsentError('Confirm the declaration before submitting.');
      return;
    }
    setConsentError('');
    setSubmitError(
      'Registration was not sent. The NestJS staff-onboarding endpoint, invitation verification, and secure document storage are not implemented yet.',
    );
  };

  return (
    <div className={styles.page}>
      <SignupHeader />
      {!role ? (
        <RoleSelection selectedRole={selectedRole} onSelect={setSelectedRole} onContinue={beginSignup} />
      ) : (
        <main className={styles.wizardMain}>
          <SignupProgress steps={steps} currentIndex={stepIndex} onNavigate={setStepIndex} />
          <div className={styles.wizardGrid}>
            <StepGuide role={role} step={currentStep} />
            <section className={styles.stepCard}>
              {currentStep === 'profile' && (
                <ProfileStep
                  role={role}
                  draft={profile}
                  errors={fieldErrors}
                  showPassword={showPassword}
                  showConfirmPassword={showConfirmPassword}
                  onChange={(patch) => { setProfile((current) => ({ ...current, ...patch })); setFieldErrors({}); }}
                  onTogglePassword={() => setShowPassword((current) => !current)}
                  onToggleConfirmPassword={() => setShowConfirmPassword((current) => !current)}
                />
              )}
              {currentStep === 'branch' && (
                <BranchStep draft={branch} errors={fieldErrors} onChange={(patch) => { setBranch((current) => ({ ...current, ...patch })); setFieldErrors({}); }} />
              )}
              {currentStep === 'assignment' && (
                <AssignmentStep confirmed={assignmentConfirmed} error={fieldErrors.assignment} onChange={(value) => { setAssignmentConfirmed(value); setFieldErrors({}); }} />
              )}
              {currentStep === 'documents' && <DocumentsStep role={role} files={files} errors={fileErrors} onFile={setFile} />}
              {currentStep === 'review' && (
                <ReviewStep
                  role={role}
                  profile={profile}
                  branch={branch}
                  files={files}
                  consent={consent}
                  consentError={consentError}
                  submitError={submitError}
                  onConsent={(value) => { setConsent(value); setConsentError(''); }}
                  onEdit={editStep}
                />
              )}

              <footer className={styles.stepFooter}>
                <button type="button" className={styles.backButton} onClick={back}>
                  <ArrowLeft aria-hidden="true" /> {stepIndex === 0 ? 'Change role' : 'Back'}
                </button>
                <span><LockKeyhole aria-hidden="true" /> Details remain in this browser until the page is closed.</span>
                {currentStep === 'review' ? (
                  <button type="button" className={styles.primaryButton} onClick={submit}>
                    {role === 'franchise-admin' ? 'Activate account' : 'Submit registration'} <ArrowRight aria-hidden="true" />
                  </button>
                ) : (
                  <button type="button" className={styles.primaryButton} onClick={next}>
                    {currentStep === 'documents' ? 'Review registration' : currentStep === 'profile' && role === 'branch-manager' ? 'Continue to assignment' : currentStep === 'profile' && role === 'branch-owner' ? 'Continue to branch' : currentStep === 'profile' ? 'Continue to documents' : 'Continue to documents'}
                    <ArrowRight aria-hidden="true" />
                  </button>
                )}
              </footer>
            </section>
          </div>
        </main>
      )}
      <div className={styles.waves}><SignupWaves /></div>
    </div>
  );
}
