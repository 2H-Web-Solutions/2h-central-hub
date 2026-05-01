/**
 * Helper to dynamically parse a rule template and replace {variables} with project data.
 * Returns the parsed string and an array of missing variable keys.
 */
export const parseRuleTemplate = (
    template: string,
    projectData: Record<string, any>,
    missingOverrides: Record<string, string> = {}
): { parsedTemplate: string; missingKeys: string[] } => {
    
    const missingKeysSet = new Set<string>();
    
    // Match any placeholder in the format {variable_name}
    const regex = /\{([\w]+)\}/g;
    
    const parsedTemplate = template.replace(regex, (match, key) => {
        // 1. Check if we have a temporary manual override
        if (missingOverrides[key] !== undefined && missingOverrides[key].trim() !== '') {
            return missingOverrides[key];
        }
        
        // 2. Check if the projectData has the key
        if (projectData[key] !== undefined && projectData[key] !== null && projectData[key] !== '') {
            return String(projectData[key]);
        }
        
        // 3. Special case handling (e.g. mapping standard project fields to likely placeholder names)
        // E.g., if placeholder is {project_name}, map it to projectData.name
        if (key === 'project_name' && projectData.name) return String(projectData.name);
        if (key === 'project_type' && projectData.type) return String(projectData.type);
        if (key === 'client_name' && projectData.clientName) return String(projectData.clientName);
        if (key === 'github_repo' && projectData.githubUrl) return String(projectData.githubUrl);
        if (key === 'primary_color' && projectData.designConfig?.primaryColor) return String(projectData.designConfig.primaryColor);
        if (key === 'secondary_color' && projectData.designConfig?.secondaryColor) return String(projectData.designConfig.secondaryColor);
        if (key === 'tertiary_color' && projectData.designConfig?.tertiaryColor) return String(projectData.designConfig.tertiaryColor);
        if (key === 'background_color' && projectData.designConfig?.backgroundColor) return String(projectData.designConfig.backgroundColor);
        if (key === 'surface_color' && projectData.designConfig?.surfaceColor) return String(projectData.designConfig.surfaceColor);
        if (key === 'text_color' && projectData.designConfig?.textColor) return String(projectData.designConfig.textColor);
        if (key === 'border_radius' && projectData.designConfig?.borderRadius) return String(projectData.designConfig.borderRadius);
        if (key === 'font_heading' && projectData.designConfig?.fontHeading) return String(projectData.designConfig.fontHeading);
        if (key === 'font_body' && projectData.designConfig?.fontBody) return String(projectData.designConfig.fontBody);
        
        // 4. Missing variable
        missingKeysSet.add(key);
        return `[MISSING: ${key}]`;
    });

    return {
        parsedTemplate,
        missingKeys: Array.from(missingKeysSet)
    };
};
