import Twilio from 'twilio';
import { env } from '../lib/env';

// Initialize Twilio client only if credentials are configured
const client =
  env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN
    ? Twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN)
    : null;

/**
 * Send OTP via Twilio Verify
 */
export async function sendOtp(phone: string): Promise<{ success: boolean; error?: string }> {
  if (!client || !env.TWILIO_VERIFY_SERVICE_SID) {
    console.error('[TWILIO] Client not configured');
    return { success: false, error: 'SMS service not configured' };
  }

  try {
    // Format phone for Twilio (E.164 format)
    const formattedPhone = formatPhoneE164(phone);

    const verification = await client.verify.v2
      .services(env.TWILIO_VERIFY_SERVICE_SID)
      .verifications.create({
        to: formattedPhone,
        channel: 'sms',
        locale: 'pt-BR',
      });

    console.log(`[TWILIO] OTP sent to ${phone}, status: ${verification.status}`);

    return { success: verification.status === 'pending' };
  } catch (error) {
    console.error('[TWILIO] Error sending OTP:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send OTP',
    };
  }
}

/**
 * Verify OTP via Twilio Verify
 */
export async function verifyOtp(
  phone: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  if (!client || !env.TWILIO_VERIFY_SERVICE_SID) {
    console.error('[TWILIO] Client not configured');
    return { success: false, error: 'SMS service not configured' };
  }

  try {
    const formattedPhone = formatPhoneE164(phone);

    const verification = await client.verify.v2
      .services(env.TWILIO_VERIFY_SERVICE_SID)
      .verificationChecks.create({
        to: formattedPhone,
        code,
      });

    console.log(`[TWILIO] OTP verification for ${phone}, status: ${verification.status}`);

    if (verification.status === 'approved') {
      return { success: true };
    }

    return {
      success: false,
      error: 'Invalid or expired code',
    };
  } catch (error) {
    console.error('[TWILIO] Error verifying OTP:', error);

    // Handle specific Twilio errors
    if (error instanceof Error) {
      if (error.message.includes('VerificationCheck was not found')) {
        return { success: false, error: 'Code expired. Request a new one.' };
      }
      if (error.message.includes('Max check attempts')) {
        return { success: false, error: 'Too many attempts. Request a new code.' };
      }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Verification failed',
    };
  }
}

/**
 * Format Brazilian phone to E.164 format
 * Input: "34999887766" or "(34) 99988-7766"
 * Output: "+5534999887766"
 */
function formatPhoneE164(phone: string): string {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');

  // If already has country code
  if (digits.startsWith('55') && digits.length === 13) {
    return `+${digits}`;
  }

  // Add Brazil country code
  return `+55${digits}`;
}
