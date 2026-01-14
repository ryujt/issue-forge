export class NotificationProvider {
  send(message) {
    throw new Error('send() must be implemented by subclass');
  }

  sendAgentResponse(message) {
    throw new Error('sendAgentResponse() must be implemented by subclass');
  }

  getName() {
    throw new Error('getName() must be implemented by subclass');
  }
}
