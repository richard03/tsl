type TitleTextType = "headlineSmall" | "titleLarge" | "titleSmall";

interface TitleTextProps {
  type?: TitleTextType;
  title: string;
}

const TAG_BY_TYPE: Record<TitleTextType, "h1" | "h2" | "h3"> = {
  headlineSmall: "h1",
  titleLarge: "h2",
  titleSmall: "h3",
};

export function TitleText({ type = "headlineSmall", title }: TitleTextProps) {
  const Tag = TAG_BY_TYPE[type];
  return <Tag className={`title-text title-text--${type}`}>{title}</Tag>;
}
