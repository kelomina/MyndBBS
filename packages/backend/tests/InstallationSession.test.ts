import { InstallationSession } from '../src/domain/provisioning/InstallationSession';

describe('InstallationSession Entity', () => {
  it('should create a valid installation session', () => {
    const session = InstallationSession.create({
      id: 'session-123',
      createdAt: new Date(),
      isCompleted: false
    });
    
    expect(session.id).toBe('session-123');
    expect(session.isCompleted).toBe(false);
  });

  it('should mark session as completed', () => {
    const session = InstallationSession.create({
      id: 'session-123',
      createdAt: new Date(),
      isCompleted: false
    });
    
    session.markCompleted();
    expect(session.isCompleted).toBe(true);
  });

  it('should throw when marking an already completed session', () => {
    const session = InstallationSession.create({
      id: 'session-123',
      createdAt: new Date(),
      isCompleted: true
    });
    
    expect(() => session.markCompleted()).toThrow('ERR_INSTALLATION_SESSION_ALREADY_COMPLETED');
  });

  it('should throw if id is missing', () => {
    expect(() => InstallationSession.create({
      id: '',
      createdAt: new Date(),
      isCompleted: false
    })).toThrow('ERR_INSTALLATION_SESSION_MISSING_ID');
  });
});
