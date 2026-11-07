import { z } from 'zod';

const name = z.string().trim().min(1).max(24);
const code = z.string().trim().toUpperCase().regex(/^[A-Z0-9]{4,16}$/);
const card = z.number().int().min(1).max(999);
const theme = z.enum(['A', 'B']);

export const schemas = {
  create: z.object({ name, password: z.string().max(200).optional() }),
  join: z.object({ code, name: name.optional(), token: z.string().max(100).optional() }),
  playerRef: z.object({ playerId: z.string().max(40) }),
  move: z.object({ playerId: z.string().max(40), dir: z.union([z.literal(-1), z.literal(1)]) }),
  difficulty: z.object({ difficulty: z.enum(['normal', 'easy']) }),
  action: z.discriminatedUnion('type', [
    z.object({ type: z.literal('swapThemes'), slots: z.array(theme).min(1).max(2) }),
    z.object({ type: z.literal('chooseRequired'), count: z.number().int() }),
    z.object({ type: z.literal('setRequired'), count: z.number().int() }),
    z.object({ type: z.literal('adjustRequired'), delta: z.union([z.literal(1), z.literal(-1)]) }),
    z.object({ type: z.literal('swapHand'), cards: z.array(card).max(6) }),
    z.object({ type: z.literal('select'), card, theme: theme.nullable() }),
    z.object({ type: z.literal('ready'), ready: z.boolean() }),
    z.object({ type: z.literal('place'), card, placement: z.enum(['A', 'B', 'forgery']).nullable() }),
    z.object({ type: z.literal('ask'), card }),
    z.object({ type: z.literal('confirmSort') }),
    z.object({ type: z.literal('nextRound') }),
  ]),
};
