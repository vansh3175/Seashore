export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { prisma } from '@/utils/prisma'; 
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  // 1. Get the Webhook Secret from Dashboard
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error('Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local');
  }

  // 2. Get Headers
  const headerPayload = await headers(); // returns a promise
  const svix_id =  headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // If missing headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error occured -- no svix headers', {
      status: 400
    });
  }

  // 3. Verify Payload
  const payload = await req.json();
  const body = JSON.stringify(payload);
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return new Response('Error occured', {
      status: 400
    });
  }

  // 4. Handle The Events
  const eventType = evt.type;

  if (eventType === 'user.created') {
    const { id, email_addresses, first_name, last_name } = evt.data;
    
    const email = email_addresses[0]?.email_address;
    const name = `${first_name || ''} ${last_name || ''}`.trim();

    await prisma.user.create({
      data: {
        id: id, // Use Clerk's ID as our Primary Key
        email: email,
        name: name || 'Anonymous',
      }
    });
    console.log(`User created: ${id}`);
  }

  if (eventType === 'user.updated') {
    const { id, email_addresses, first_name, last_name } = evt.data;
    
    await prisma.user.update({
      where: { id: id },
      data: {
        email: email_addresses[0]?.email_address,
        name: `${first_name || ''} ${last_name || ''}`.trim(),
      }
    });
    console.log(`User updated: ${id}`);
  }

  if (eventType === 'user.deleted') {
    const { id } = evt.data;
    
    await prisma.user.delete({
      where: { id: id },
    });
    console.log(`User deleted: ${id}`);
  }

  return NextResponse.json({ message: 'Webhook received' }, { status: 200 });
}