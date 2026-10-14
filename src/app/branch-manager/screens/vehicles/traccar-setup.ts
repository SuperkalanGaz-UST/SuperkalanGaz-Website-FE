// Public hardware ingress only; the browser never receives Traccar API credentials.
export const trackerDestination = { host: '34.158.48.168', port: 5013, protocol: 'H02' } as const;

// Standard ST-901 manual, linked in the UI. 0000 is the factory SMS password,
// not a Traccar credential. A changed device password must be substituted manually.
export const trackerSmsCommands = [
    { label: 'Read and save the original settings', command: 'RCONF' },
    { label: 'Set the SIM carrier APN (replace APN)', command: '8030000 APN' },
    { label: 'Enable GPRS data reporting', command: '7100000' },
    { label: 'Set the cloud tracker destination', command: `8040000 ${trackerDestination.host} ${trackerDestination.port}` },
    { label: 'Check the saved settings again', command: 'RCONF' },
] as const;

export const trackerManualUrl = 'https://shopcdnalpha.grainajz.com/category/365208/2174/a3cab559c55314df72ae9f6b1a12f93f/ST-901%20User%20Manual%20246.pdf';

export type GpsProvisioningStatus = 'unconfigured' | 'pending' | 'provisioned' | 'failed';

// Provisioning confirms a middleware record, not a position or an online device.
export function gpsRegistrationBadge(status: GpsProvisioningStatus) {
    switch (status) {
        case 'provisioned': return { label: 'Registered in Traccar', variant: 'success' as const };
        case 'failed': return { label: 'Registration error', variant: 'destructive' as const };
        case 'pending': return { label: 'Registering device', variant: 'warning' as const };
        case 'unconfigured': return { label: 'GPS not registered', variant: 'secondary' as const };
    }
}

export function gpsRegistrationNotice(plate: string) {
    return `${plate}: device registered in Traccar. Live GPS reception still needs verification.`;
}
