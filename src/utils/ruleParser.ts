/**
 * Helper to dynamically parse a rule template and replace {variables} with project data.
 * Returns the parsed string and an array of missing variable keys.
 */
export const parseRuleTemplate = (
    template: string,
    projectData: Record<string, any>,
    missingOverrides: Record<string, string> = {}
): { parsedTemplate: string; missingKeys: string[]; allKeys: string[]; resolvedValues: Record<string, string> } => {
    
    const missingKeysSet = new Set<string>();
    const allKeysSet = new Set<string>();
    const resolvedValues: Record<string, string> = {};
    
    // Match any placeholder in the format {variable_name}
    const regex = /\{([\w]+)\}/g;
    
    const parsedTemplate = template.replace(regex, (match, key) => {
        allKeysSet.add(key);

        // 1. Check if we have a temporary manual override
        if (missingOverrides[key] !== undefined && missingOverrides[key].trim() !== '') {
            resolvedValues[key] = missingOverrides[key];
            return missingOverrides[key];
        }
        
        let value = '';
        // 2. Check if the projectData has the key
        if (projectData[key] !== undefined && projectData[key] !== null && projectData[key] !== '') {
            value = String(projectData[key]);
        }
        
        // 3. Special case handling
        else if (key === 'project_name' && projectData.name) value = String(projectData.name);
        else if (key === 'project_type' && projectData.type) value = String(projectData.type);
        else if (key === 'client_name' && projectData.clientName) value = String(projectData.clientName);
        else if (key === 'github_repo' && projectData.githubUrl) value = String(projectData.githubUrl);
        else if (key === 'primary_color' && projectData.designConfig?.primaryColor) value = String(projectData.designConfig.primaryColor);
        else if (key === 'secondary_color' && projectData.designConfig?.secondaryColor) value = String(projectData.designConfig.secondaryColor);
        else if (key === 'tertiary_color' && projectData.designConfig?.tertiaryColor) value = String(projectData.designConfig.tertiaryColor);
        else if (key === 'background_color' && projectData.designConfig?.backgroundColor) value = String(projectData.designConfig.backgroundColor);
        else if (key === 'surface_color' && projectData.designConfig?.surfaceColor) value = String(projectData.designConfig.surfaceColor);
        else if (key === 'text_color' && projectData.designConfig?.textColor) value = String(projectData.designConfig.textColor);
        else if (key === 'border_radius' && projectData.designConfig?.borderRadius) value = String(projectData.designConfig.borderRadius);
        else if (key === 'font_heading' && projectData.designConfig?.fontHeading) value = String(projectData.designConfig.fontHeading);
        else if (key === 'font_body' && projectData.designConfig?.fontBody) value = String(projectData.designConfig.fontBody);
        
        if (value) {
            resolvedValues[key] = value;
            return value;
        }

        // 4. Missing variable
        missingKeysSet.add(key);
        resolvedValues[key] = '';
        return `[MISSING: ${key}]`;
    });

    return {
        parsedTemplate,
        missingKeys: Array.from(missingKeysSet),
        allKeys: Array.from(allKeysSet),
        resolvedValues
    };
};
