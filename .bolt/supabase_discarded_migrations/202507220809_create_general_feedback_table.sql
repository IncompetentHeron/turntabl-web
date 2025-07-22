CREATE TABLE public.general_feedback (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    feedback_text text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.general_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can insert general feedback" ON public.general_feedback
FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Authenticated users can view own general feedback" ON public.general_feedback
FOR SELECT USING (auth.uid() = user_id);
