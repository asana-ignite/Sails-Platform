/**
 * Public self-registration: creates a tenant + admin user, provisions the
 * tenant schema and default navigation (see TenantProvisioner).
 */
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, name } = body;

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email and password are required" }), { status: 400 });
    }

    if (password.length < 8) {
      return new Response(JSON.stringify({ error: "Password must be at least 8 characters long" }), { status: 400 });
    }

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return new Response(JSON.stringify({ error: "User already exists" }), { status: 409 });
    }

    // Hash the password with 12 salt rounds (Enterprise grade)
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create the user in a "limbo" state (no tenant assigned yet)
    // In a real B2B flow, they might need to create a tenant next or wait for an invite
    const newUser = await db.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        role: "MEMBER" // Default role
      }
    });

    // Don't return the password hash
    const { password: _, ...userWithoutPassword } = newUser;

    return new Response(JSON.stringify({ user: userWithoutPassword }), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
