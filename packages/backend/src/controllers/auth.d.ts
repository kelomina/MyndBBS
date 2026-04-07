import { Request, Response } from 'express';
export declare const generateRegisterChallenge: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const verifyRegisterChallenge: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=auth.d.ts.map