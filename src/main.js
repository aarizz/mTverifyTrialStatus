import { Client, Users } from 'node-appwrite';

// This Appwrite function will be executed every time your function is triggered
export default async ({ req, res, log, error }) => {
  const client = new Client()
    .setEndpoint('https://cloud.appwrite.io/v1')
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

    const users = new Users(client);

    const payload = req.bodyJson;
    const userId = payload.userId;

    log.info(`Verifying trial status for user: ${userId}`);

    try {
      // Get user data from Appwrite
      const user = await users.get(userId);
      
      // If no prefs or signup date, user has no trial
      if (!user.prefs || !user.prefs.signupDate || !user.prefs.trialSignature) {
        return res.json({ isInTrial: false, daysRemaining: 0 });
      }
      
      // Verify the signature to ensure timestamp hasn't been tampered with
      const isSignatureValid = verifySignature(
        user.prefs.signupDate, 
        user.prefs.trialSignature
      );
      
      if (!isSignatureValid) {
        console.warn(`Invalid trial signature detected for user ${userId}`);
        return res.json({ isInTrial: false, daysRemaining: 0 });
      }
      
      // Calculate trial status using server time
      const signupDate = new Date(user.prefs.signupDate);
      const currentDate = new Date();
      const trialLengthDays = user.prefs.trialLength || 20;
      
      const daysSinceSignup = Math.floor(
        (currentDate - signupDate) / (1000 * 60 * 60 * 24)
      );
      
      const daysRemaining = Math.max(0, trialLengthDays - daysSinceSignup);
      const isInTrial = daysRemaining > 0;
      
      return res.json({
        isInTrial,
        daysRemaining,
        serverTime: currentDate.toISOString()
      });
    } catch (error) {
      console.error('Error verifying trial status:', error);
      return res.json({ success: false, message: error.message }, 500);
    }
  };
  
  function verifySignature(timestamp, signature) {
    const crypto = require('crypto');
    const secretKey = process.env.SIGNATURE_SECRET;
    const expectedSignature = crypto
      .createHmac('sha256', secretKey)
      .update(timestamp)
      .digest('hex');
    
    return expectedSignature === signature;
  }
