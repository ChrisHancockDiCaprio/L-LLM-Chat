export function createOllamaRequest(messages) {
    if (!Array.isArray(messages) || messages.length === 0) throw new Error('messages muss ein nichtleeres Array sein');
    for (const msg of messages) {
        if (msg === null || typeof msg !== 'object' || Array.isArray(msg)) throw new Error('Jeder Eintrag muss ein Objekt mit role und content sein');
        if (!['user', 'assistant'].includes(msg.role)) throw new Error('role muss "user" oder "assistant" sein');
        if (typeof msg.content !== 'string' || msg.content.trim() === '') throw new Error('content muss ein nichtleerer String sein');
    }
    for (const msg of messages) if (msg.images !== undefined && (!Array.isArray(msg.images) || msg.images.length > 4 || msg.images.some(x => typeof x !== 'string' || x.length > 12 * 1024 * 1024 || !/^[A-Za-z0-9+/]+={0,2}$/.test(x)))) throw new Error('Ungültige Bildeingaben.');
    return { model: 'qwen3.5:4b', messages: messages.map(({ role, content, images }) => ({ role, content, ...(images?.length ? { images: [...images] } : {}) })), stream: false, think: false };
}
