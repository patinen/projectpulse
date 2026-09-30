import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service.js';
import type { ActivityEvent, ActivityEventKind, ActivityKindFilter, ActivityRange, ActivityRepositoryFilter, ActivityResponse } from './activity.types.js';

const VALID_EVENT_KINDS = new Set<ActivityEventKind>([
  'commit pushed',
  'issue opened',
  'pull request merged',
]);

const RANGE_DAYS: Record<ActivityRange, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

export type ActivityQueryOptions = {
  range?: string;
  kind?: string;
  repository?: string;
};

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async getActivity(userId: string, query: ActivityQueryOptions = {}): Promise<ActivityResponse> {
    const range = this.normalizeRange(query.range ?? '30d');
    const kind = this.normalizeKind(query.kind ?? 'all');
    const repositoryFilter = typeof query.repository === 'string' && query.repository.trim() ? query.repository.trim() : null;

    const now = new Date();
    const rangeCutoff = new Date(now.getTime() - RANGE_DAYS[range] * 24 * 60 * 60 * 1000);
    const snapshots = await this.prisma.dashboardSnapshot.findMany({
      where: {
        userId,
        capturedAt: {
          gte: rangeCutoff,
        },
      },
      select: {
        capturedAt: true,
        recentActivity: true,
      },
      orderBy: {
        capturedAt: 'desc',
      },
    });

    const deduplicated = this.reconstructEvents(snapshots);
    const inRange = deduplicated.filter((event) => {
      const occurredAt = new Date(event.occurredAt).getTime();
      return occurredAt >= rangeCutoff.getTime() && occurredAt <= now.getTime();
    });

    const repositoryNames = Array.from(new Set(inRange.map((event) => event.repository))).sort((left, right) => left.localeCompare(right));
    const trackedMap = await this.loadTrackedRepositoryMap(userId);

    const repositories: ActivityRepositoryFilter[] = repositoryNames.map((fullName) => {
      const trackedRepo = trackedMap.get(fullName);
      return {
        fullName,
        githubId: trackedRepo?.githubId ?? null,
        tracked: trackedRepo ? true : false,
      };
    });

    const byKind = kind === 'all' ? inRange : inRange.filter((event) => this.kindMatches(kind, event.kind));
    const filteredByRepository = repositoryFilter
      ? byKind.filter((event) => event.repository === repositoryFilter)
      : byKind;

    const sorted = [...filteredByRepository].sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime());
    const eventCount = sorted.length;
    const limited = sorted.slice(0, 100);

    return {
      range: {
        value: range,
        from: rangeCutoff.toISOString(),
        to: now.toISOString(),
      },
      filters: {
        kind,
        repository: repositoryFilter,
      },
      repositories,
      events: limited,
      meta: {
        eventCount,
        latestSnapshotAt: snapshots[0]?.capturedAt ? snapshots[0].capturedAt.toISOString() : null,
      },
    };
  }

  private normalizeRange(value: string): ActivityRange {
    if (value === '7d' || value === '30d' || value === '90d') {
      return value;
    }

    throw new BadRequestException('Unsupported activity range. Use 7d, 30d, or 90d.');
  }

  private normalizeKind(value: string): ActivityKindFilter {
    if (value === 'all' || value === 'commit' || value === 'issue' || value === 'pr') {
      return value;
    }

    throw new BadRequestException('Unsupported activity type. Use all, commit, issue, or pr.');
  }

  private kindMatches(kind: ActivityKindFilter, eventKind: ActivityEventKind): boolean {
    if (kind === 'all') {
      return true;
    }

    if (kind === 'commit') {
      return eventKind === 'commit pushed';
    }

    if (kind === 'issue') {
      return eventKind === 'issue opened';
    }

    return eventKind === 'pull request merged';
  }

  private reconstructEvents(snapshots: Array<{ capturedAt: Date; recentActivity: Prisma.JsonValue | null }>): ActivityEvent[] {
    const deduplicated = new Map<string, { event: ActivityEvent; snapshotTime: number }>();

    for (const snapshot of snapshots) {
      const items = Array.isArray(snapshot.recentActivity) ? snapshot.recentActivity : [];
      for (const item of items) {
        const event = this.normalizeEvent(item);
        if (!event) {
          continue;
        }

        const snapshotTime = snapshot.capturedAt.getTime();
        const existing = deduplicated.get(event.id);

        if (!existing || snapshotTime >= existing.snapshotTime) {
          deduplicated.set(event.id, { event, snapshotTime });
        }
      }
    }

    return [...deduplicated.values()].map((entry) => entry.event);
  }

  private normalizeEvent(value: unknown): ActivityEvent | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const entry = value as Record<string, unknown>;
    const id = typeof entry.id === 'string' ? entry.id.trim() : '';
    const repository = typeof entry.repository === 'string' ? entry.repository.trim() : '';
    const title = typeof entry.title === 'string' ? entry.title : '';
    const occurredAt = typeof entry.occurredAt === 'string' ? entry.occurredAt.trim() : '';
    const url = typeof entry.url === 'string' ? entry.url.trim() : '';
    const kind = typeof entry.kind === 'string' ? entry.kind : '';
    let actor: string | null;

    if (entry.actor === null) {
      actor = null;
    } else if (typeof entry.actor === 'string') {
      actor = entry.actor.trim() || null;
    } else {
      return null;
    }

    if (!id || !repository || !title || !occurredAt || !url || !VALID_EVENT_KINDS.has(kind as ActivityEventKind)) {
      return null;
    }

    const parsedDate = new Date(occurredAt);
    if (Number.isNaN(parsedDate.getTime())) {
      return null;
    }

    return {
      id,
      kind: kind as ActivityEventKind,
      repository,
      title,
      actor,
      occurredAt: parsedDate.toISOString(),
      url,
    };
  }

  private async loadTrackedRepositoryMap(userId: string): Promise<Map<string, { githubId: string }>> {
    const rows = await this.prisma.trackedRepository.findMany({
      where: { userId },
      select: {
        repository: {
          select: {
            githubId: true,
            fullName: true,
          },
        },
      },
    });

    const map = new Map<string, { githubId: string }>();
    for (const row of rows) {
      if (row.repository?.fullName) {
        map.set(row.repository.fullName, { githubId: row.repository.githubId });
      }
    }

    return map;
  }
}
