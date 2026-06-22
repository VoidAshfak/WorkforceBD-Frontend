import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

import type { PresignData, PresignPurpose, WorkerCatalog, WorkerProfile } from "@/types/worker";
import type {
  AvailabilityInput,
  BasicInfoInput,
  DocumentsInput,
  SkillsInput,
} from "@/lib/validation/worker";

type ApiEnvelope<T> = { success: boolean; message: string; data: T };

/**
 * Worker onboarding API. Talks only to the local BFF (`/api/worker/*`,
 * `/api/upload/*`), which injects the access token from httpOnly cookies — the
 * browser never holds a token or hits the backend directly.
 */
export const workerApi = createApi({
  reducerPath: "workerApi",
  baseQuery: fetchBaseQuery({ baseUrl: "/api", credentials: "same-origin" }),
  tagTypes: ["WorkerProfile"],
  endpoints: (build) => ({
    getCatalog: build.query<WorkerCatalog, void>({
      query: () => ({ url: "/worker/catalog", method: "GET" }),
      transformResponse: (res: ApiEnvelope<WorkerCatalog>) => res.data,
    }),

    getWorkerProfile: build.query<WorkerProfile, void>({
      query: () => ({ url: "/worker/profile", method: "GET" }),
      transformResponse: (res: ApiEnvelope<WorkerProfile>) => res.data,
      providesTags: ["WorkerProfile"],
    }),

    saveBasic: build.mutation<{ message: string }, BasicInfoInput>({
      query: (body) => ({ url: "/worker/profile/basic", method: "PATCH", body }),
      invalidatesTags: ["WorkerProfile"],
    }),

    saveSkills: build.mutation<{ message: string }, SkillsInput>({
      query: (body) => ({ url: "/worker/profile/skills", method: "PATCH", body }),
      invalidatesTags: ["WorkerProfile"],
    }),

    saveAvailability: build.mutation<{ message: string }, AvailabilityInput>({
      query: (body) => ({ url: "/worker/profile/availability", method: "PATCH", body }),
      invalidatesTags: ["WorkerProfile"],
    }),

    saveDocuments: build.mutation<{ message: string }, DocumentsInput>({
      query: (body) => ({ url: "/worker/profile/documents", method: "PATCH", body }),
      invalidatesTags: ["WorkerProfile"],
    }),

    presign: build.mutation<PresignData, { purpose: PresignPurpose }>({
      query: (body) => ({ url: "/upload/presign", method: "POST", body }),
      transformResponse: (res: ApiEnvelope<PresignData>) => res.data,
    }),
  }),
});

export const {
  useGetCatalogQuery,
  useGetWorkerProfileQuery,
  useSaveBasicMutation,
  useSaveSkillsMutation,
  useSaveAvailabilityMutation,
  useSaveDocumentsMutation,
  usePresignMutation,
} = workerApi;
