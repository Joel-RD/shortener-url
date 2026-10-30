import type { Request } from "express";
import { JwtPayload } from "jsonwebtoken";
import { AttemptScope } from "../utils/attemptLimiter.js";

export type RequestModel = Request & {
    userEmail?: string;
};

export type JwtTokenType = "session" | "email_verification";

export interface CustomJwtPayload extends JwtPayload {
    userEmail: string;
    typ: JwtTokenType;
}

export interface ConfigCookiesParams {
    httpOnly: boolean;
    secure: boolean;
    sameSite: boolean | "lax" | "strict" | "none";
    maxAge: number;
    path: string;
}

export interface IUrlRepository {
    findById(short_url: string): Promise<string | null>;
    create(short_url: string, original_url: string): Promise<string>;
    incrementViews(short_url: string): Promise<void>;
}

export interface CreateUser {
    username: string;
    email: string;
    passwordHash: string;
}

export interface UserAuthData {
    id: number;
    username: string;
    email: string;
    password_hash: string;
    name?: string | null;
    last_name?: string | null;
    email_verified?: number | boolean | null;
    account_active?: number | boolean | null;
    email_attempt_count?: number;
    email_blocked_until?: string | null;
    password_attempt_count?: number;
    password_blocked_until?: string | null;
}

export interface ApiSuccess<T = unknown> {
    success: true;
    message?: string;
    data?: T;
}

export interface ApiErrorBody {
    success: false;
    message: string;
    error: {
        code: string;
        message: string;
        details?: unknown;
    };
}

export interface IAuthRepository {
    findByEmail(email: string): Promise<UserAuthData | null>;
    create(user: CreateUser): Promise<UserAuthData>;
    savedVerificationCode(email: string, code: string): Promise<void>;
    verifyVerificationCode(email: string, code: string): Promise<boolean>;
    markEmailVerified(email: string): Promise<void>;
    updateUsedVerificationCode(email: string): Promise<void>;
    deleteVerificationCode(email: string): Promise<void>;
    getActiveVerificationCode(email: string): Promise<{ expires_at: string } | null>;
    checkBlocked(scope: AttemptScope, email: string): Promise<{ blocked: boolean; retryAfterMinutes: number }>;
    registerAttempt(scope: AttemptScope, email: string): Promise<{ blocked: boolean; attemptsLeft: number }>;
    resetAttempts(scope: AttemptScope, email: string): Promise<void>;
}

export type { AttemptScope };
