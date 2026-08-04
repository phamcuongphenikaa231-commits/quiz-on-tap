-- Optional Migration: Remove general_explanation column from questions table
-- DO NOT RUN AUTOMATICALLY until all existing data and references have been fully verified.

begin;

alter table public.questions
drop column if exists general_explanation;

commit;
