export declare const generateTokens: (userId: string, role: string) => {
    accessToken: string;
    refreshToken: string;
};
export declare const verifyAccessToken: (token: string) => {
    userId: string;
    role: string;
};
export declare const verifyRefreshToken: (token: string) => {
    userId: string;
    role: string;
};
//# sourceMappingURL=jwt.d.ts.map