// test-resend.ts — run with: npx tsx test-resend.ts
import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY);

resend.emails.send({
  from: 'my@email.com',
  to: 'myemail@gmail.com',
  subject: 'Your Account Has Been Created',
  html: '<p>Your account has been successfully created.</p>',
}).then(console.log).catch(console.error);